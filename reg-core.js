/* reg-core.js – shooter registration, ID/cell (opt-in, admin-only) helpers, in-app dialogs and indemnity filler.
   Copied from Spectre Scoring register.html (21 Nov 2026 build) so the qualifier app registers shooters the same way,
   but against the qualifier's OWN Firebase project (see firebase-config.js). Shared by index.html (organiser) and register.html. */
/* In-app dialogs (archive / register / verify pages): promise-based replacements for alert / confirm / prompt.
   Native dialogs are never used: after a few, mobile browsers offer "Prevent this page from creating additional dialogs",
   and once ticked every later alert/confirm silently fails and buttons stop working until a reload. Works offline (no assets). */
(function(){
  var Q = Promise.resolve(), css = false;
  function addCss(){ if(css) return; css = true; var s = document.createElement("style");
    s.textContent = ".ssdlg-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px}" +
      ".ssdlg{background:#fff;color:#111;border-radius:12px;max-width:440px;width:100%;padding:18px 18px 14px;box-shadow:0 10px 40px rgba(0,0,0,.4);font:16px/1.4 system-ui,Arial,sans-serif}" +
      ".ssdlg p{margin:0 0 14px;white-space:pre-wrap}.ssdlg input{width:100%;box-sizing:border-box;font-size:16px;padding:9px;margin:0 0 14px;border:1px solid #888;border-radius:8px}" +
      ".ssdlg .b{display:flex;gap:10px;justify-content:flex-end}.ssdlg button{font-size:16px;padding:10px 16px;border-radius:8px;border:1px solid #14284b;background:#fff;color:#14284b;min-height:44px}" +
      ".ssdlg button.ok{background:#14284b;color:#fff}.ssdlg button.ok.danger{background:#b3261e;border-color:#b3261e}@media print{.ssdlg-bg{display:none}}";
    document.head.appendChild(s); }
  function show(kind, msg, o){ o = o || {};
    var run = function(){ return new Promise(function(res){ addCss();
      var prev = document.activeElement, bg = document.createElement("div"), id = "ssdlg" + Date.now();
      bg.className = "ssdlg-bg"; bg.innerHTML = '<div class="ssdlg" role="' + (kind === "alert" ? "alertdialog" : "dialog") + '" aria-modal="true" aria-labelledby="' + id + '"><p id="' + id + '"></p>' +
        (kind === "prompt" ? '<input type="text" aria-labelledby="' + id + '">' : "") + '<div class="b">' + (kind === "alert" ? "" : '<button type="button" class="no"></button>') + '<button type="button" class="ok"></button></div></div>';
      bg.querySelector("p").textContent = String(msg == null ? "" : msg);
      var ok = bg.querySelector(".ok"), no = bg.querySelector(".no"), inp = bg.querySelector("input");
      ok.textContent = o.ok || "OK"; if(o.danger) ok.className += " danger"; if(no) no.textContent = o.cancel || "Cancel"; if(inp) inp.value = o.value || "";
      function done(v){ document.removeEventListener("keydown", key, true); bg.remove(); try{ prev && prev.focus && prev.focus(); }catch(e){} res(v); }
      function key(ev){ if(ev.key === "Escape"){ ev.preventDefault(); done(kind === "alert" ? undefined : kind === "prompt" ? null : false); }
        else if(ev.key === "Enter" && (ev.target === inp || ev.target === ok)){ ev.preventDefault(); ok.click(); }
        else if(ev.key === "Tab"){ var f = [inp, no, ok].filter(Boolean), i = f.indexOf(document.activeElement); ev.preventDefault(); f[(i + (ev.shiftKey ? f.length - 1 : 1)) % f.length].focus(); } }
      ok.onclick = function(){ done(kind === "alert" ? undefined : kind === "prompt" ? inp.value : true); };
      if(no) no.onclick = function(){ done(kind === "prompt" ? null : false); };
      document.addEventListener("keydown", key, true); document.body.appendChild(bg); (inp || ok).focus(); }); };
    var p = Q.then(run); Q = p.then(function(){}, function(){}); return p; }   /* one at a time, in call order */
  window.uiAlert = function(m, o){ return show("alert", m, o); };
  window.uiConfirm = function(m, o){ return show("confirm", m, o); };
  window.uiPrompt = function(m, v, o){ o = o || {}; o.value = v; return show("prompt", m, o); };
  /* safety net: anything (incl. bundled libraries) that still calls the natives gets the in-app dialog instead */
  window.alert = function(m){ uiAlert(m); };
  window.confirm = function(m){ console.warn("native confirm() blocked – use uiConfirm:", m); return false; };
  window.prompt = function(m){ console.warn("native prompt() blocked – use uiPrompt:", m); return null; };
})();

/* ===================== Shooter registration – shared by the scoring app (organiser) and register.html (shooters) =====================
   regs/{CODE}                 match registration (name, date, divisions, squads {id:{n,max}}, closesMs, closed) – no personal data
   regs/{CODE}/counts/{squad}  public squad counters {n, last}
   regs/{CODE}/entries/{TOKEN} one entry; the 24-character random id is the shooter's private edit token
   Every entry change runs in a transaction together with the squad counter(s) it moves, so a full squad can never be overfilled. */
var REG_TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function regToken(){ var s = "", r = new Uint32Array(24); crypto.getRandomValues(r); for(var i = 0; i < 24; i++) s += REG_TOKEN_CHARS[r[i] % REG_TOKEN_CHARS.length]; return s; }
function regCleanTok(t){ t = String(t || ""); return /^[A-Za-z0-9]{24}$/.test(t) ? t : ""; }
function regSquadIds(reg){ return Object.keys(reg && reg.squads || {}).sort(function(a, b){ return a.localeCompare(b, undefined, { numeric: true }); }); }
function regIsOpen(reg, now){ return !!reg && !reg.closed && (now || Date.now()) < reg.closesMs; }
function regDivCode(d){ return String(d || "").split(" – ")[0].trim(); }
/* per-discipline divisions of an entry: { handgun|shotgun|rifle: { d: code, pf } }. Old single-division entries map onto the discipline of their division. */
var REG_DISCS = ["handgun", "shotgun", "rifle"], REG_DISC_N = { handgun: "Handgun", shotgun: "Shotgun", rifle: "Rifle" };
function regDiscOfCode(c){ var cls = typeof CLS !== "undefined" ? CLS[c] : null, g = cls ? cls.g : ({ SMS:1, EMS:1, SSS:1, ESS:1 }[c] ? "shotgun" : /^(SSP|ESP|SCP|ECP|SPP|EPP|JMB|SRR|ERR|SCR|ECR)$/.test(c) ? "pistol" : "rifle");
  return g === "pistol" || g === "revolver" ? "handgun" : g === "shotgun" ? "shotgun" : "rifle"; }
function regEntryDivs(e){ if(e.divs && Object.keys(e.divs).length) return e.divs; var o = {}; if(e.division){ var k = regDiscOfCode(regDivCode(e.division)); o[k] = { d: regDivCode(e.division) }; if(k !== "shotgun") o[k].pf = e.pf || "minor"; } return o; }
function regDivsText(e){ var d = regEntryDivs(e); return REG_DISCS.filter(function(k){ return d[k]; }).map(function(k){ return REG_DISC_N[k] + " " + d[k].d + (d[k].pf ? " " + d[k].pf : ""); }).join(" · "); }
function regNowISO(){ return new Date().toISOString(); }
/* save (create / edit / cancel / re-enter / organiser paid-remove) an entry. patch = fields to change. Resolves to the saved entry. */
function regSaveEntry(F, db, code, tok, patch, uid, asOrg){
  var regRef = F.doc(db, "regs", code), entRef = F.doc(db, "regs", code, "entries", tok), cnt = function(sq){ return F.doc(db, "regs", code, "counts", sq); };
  return F.runTransaction(db, function(tx){
    return Promise.all([tx.get(regRef), tx.get(entRef)]).then(function(r){
      if(!r[0].exists()) throw new Error("This registration does not exist.");
      var reg = r[0].data(), o = r[1].exists() ? r[1].data() : null, now = regNowISO();
      if(!asOrg && !regIsOpen(reg)) throw new Error("Registration is closed.");
      var d = Object.assign({}, o || { first: "", last: "", member: "", visitor: false, email: "", division: "", pf: "minor", cls: "", cat: "", squad: "", status: "active", paid: false, createdAt: now }, patch);
      if(!asOrg) d.uid = uid; d.updatedAt = now; if(!o){ d.paid = false; d.status = "active"; }
      if(!reg.squads[d.squad]) throw new Error("Choose a squad.");
      var wasA = !!o && o.status === "active", isA = d.status === "active", same = wasA && isA && o.squad === d.squad;
      var leave = wasA && !same ? o.squad : "", join = isA && !same ? d.squad : "";
      return Promise.all([leave ? tx.get(cnt(leave)) : null, join ? tx.get(cnt(join)) : null]).then(function(c){
        if(join){ var n = c[1] && c[1].exists() ? c[1].data().n : 0; if(n >= reg.squads[join].max) throw new Error("Squad " + reg.squads[join].n + " is full – choose another squad."); tx.set(cnt(join), { n: n + 1, last: tok }); }
        if(leave){ var m = c[0] && c[0].exists() ? c[0].data().n : 1; tx.set(cnt(leave), { n: Math.max(0, m - 1), last: tok }); }
        tx.set(entRef, d); return d;
      });
    });
  });
}
function regCSV(reg, entries){
  var q = function(v){ v = String(v == null ? "" : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var rows = [["First Name","Last Name","SWPC Member #","Visitor","Email","Handgun","Handgun PF","Shotgun","Rifle","Rifle PF","Class","Category","Squad","Status","Paid","Registered","Updated"]];
  entries.forEach(function(e){ rows.push([e.first, e.last, e.member || "", e.visitor ? "yes" : "no", e.email].concat((function(d){ return [d.handgun ? d.handgun.d : "", d.handgun ? d.handgun.pf || "" : "", d.shotgun ? d.shotgun.d : "", d.rifle ? d.rifle.d : "", d.rifle ? d.rifle.pf || "" : ""]; })(regEntryDivs(e))).concat([ e.cls, e.cat, reg.squads[e.squad] ? reg.squads[e.squad].n : e.squad, e.status, e.paid ? "yes" : "no", e.createdAt, e.updatedAt])); });
  return rows.map(function(r){ return r.map(q).join(","); }).join("\r\n") + "\r\n";
}

/* Optional SA ID + cell for the indemnity form only.
   Stored in regs/{CODE}/private/{TOKEN} (sibling of the entry, never on the entry doc).
   Registrants may create/update/delete their own; only club admins may list or purge.
   These fields must never go into backups, rooms, packs, the archive or localStorage. */
function regSaIdNorm(s){ return String(s || "").replace(/\s+/g, ""); }
function regSaIdLooks(s){ return /^\d{13}$/.test(regSaIdNorm(s)); }
function regSaIdLuhn(s){
  s = regSaIdNorm(s);
  if(!/^\d{13}$/.test(s)) return false;
  var mm = +s.slice(2, 4), dd = +s.slice(4, 6);
  if(mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  var odd = 0, even = "", i, e, es = 0;
  for(i = 0; i < 12; i++){ if(i % 2 === 0) odd += +s[i]; else even += s[i]; }
  e = String(Number(even) * 2);
  for(i = 0; i < e.length; i++) es += +e[i];
  return ((10 - (odd + es) % 10) % 10) === +s[12];
}
function regCellDigits(s){ return String(s || "").replace(/\D/g, ""); }
function regPrivWarn(id, cell){
  var w = [];
  if(regSaIdLooks(id) && !regSaIdLuhn(id)) w.push("That ID number doesn't look like a valid South African ID.");
  if(String(cell || "").trim() && regCellDigits(cell).length !== 10) w.push("That cell number is not 10 digits.");
  return w;
}
function regPrivRef(F, db, code, tok){ return F.doc(db, "regs", code, "private", tok); }
function regPrivBody(id, cell, uid, prev){
  var now = regNowISO();
  return { idNumber: String(id || "").trim().slice(0, 20), cell: String(cell || "").trim().slice(0, 20), consent: true, uid: uid, createdAt: prev && prev.createdAt ? prev.createdAt : now, updatedAt: now };
}
function regSavePrivate(F, db, code, tok, id, cell, uid, consent){
  var ref = regPrivRef(F, db, code, tok);
  id = String(id || "").trim().slice(0, 20); cell = String(cell || "").trim().slice(0, 20);
  if(!consent || (!id && !cell)) return F.deleteDoc(ref).then(function(){ return null; }, function(){ return null; });
  return F.getDoc(ref).then(function(d){ return d.exists() ? d.data() : null; }, function(){ return null; }).then(function(prev){
    var body = regPrivBody(id, cell, uid, prev);
    return F.setDoc(ref, body).then(function(){ return body; });
  });
}
function regLoadPrivate(F, db, code, tok){ return F.getDoc(regPrivRef(F, db, code, tok)).then(function(d){ return d.exists() ? d.data() : null; }, function(){ return null; }); }
function regListPrivate(F, db, code){ return F.getDocs(F.collection(db, "regs", code, "private")).then(function(q){ var m = {}; q.docs.forEach(function(d){ m[d.id] = d.data(); }); return m; }); }
function regPurgePrivate(F, db, code){
  return F.getDocs(F.collection(db, "regs", code, "private")).then(function(q){
    if(!q.docs.length) return 0;
    var n = 0, chain = Promise.resolve(), i;
    for(i = 0; i < q.docs.length; i += 400){
      (function(docs){ chain = chain.then(function(){ var b = F.writeBatch(db); docs.forEach(function(d){ b.delete(d.ref); }); return b.commit(); }); })(q.docs.slice(i, i + 400));
      n += Math.min(400, q.docs.length - i);
    }
    return chain.then(function(){ return n; });
  });
}
/* Defence: drop ID / cell keys from a pack, backup or archive payload. Never log the values. */
var IDCELL_KEY = /^(idno|idnum|idnumber|id_?number|said|rsaid|identity|identitynumber|passport|cell|cellno|cellphone|mobile|phone|tel|telephone|contact|contactno)$/i;
function stripIdCell(o){
  if(Array.isArray(o)) return o.map(stripIdCell);
  if(o && typeof o === "object"){ var r = {}, k; for(k in o){ if(Object.prototype.hasOwnProperty.call(o, k) && !IDCELL_KEY.test(k.replace(/[\s_-]/g, ""))) r[k] = stripIdCell(o[k]); } return r; }
  return o;
}

/* s-indemnity.js – SWPC Range Booking Register & Indemnity Form, pre-filled from the registration.
   Overlays text onto the club's original PDF (legal text untouched) with pdf-lib, entirely on this phone.
   Fills: date, match/squad remark, SWPC member no, name. ID number and contact number are filled only
   when an admin supplies values the shooter opted in to store (regs/.../private). Signature stays blank. */
var INDEM = { rows: 10, lib: null,
  /* PDF user-space (page is rotated 90°; text drawn rotated so it reads across the landscape page) */
  rowX: function(i){ return 350 + i * 20.05 + 14; },
  colY: { member: 33, name: 142, id: 362, cell: 516 },
  /* checkbox centres (glyph squares measured with PyMuPDF): arrival 6, departure 4 – the club does all of these, so all pre-ticked */
  boxX: [142.62, 156.17, 169.72, 183.27, 196.82, 210.37], arrY: 164.6, depY: 532.0, depN: 4,
  timeIn: "09:00", timeOut: "16:30" };
function indemLib(){
  if(window.PDFLib) return Promise.resolve(window.PDFLib);
  if(!INDEM.lib) INDEM.lib = new Promise(function(ok, no){ var s = document.createElement("script"); s.src = "indemnity-pdf.js"; s.onload = function(){ ok(window.PDFLib); }; s.onerror = function(){ INDEM.lib = null; no(new Error("Could not load the PDF maker – check the signal.")); }; document.head.appendChild(s); });
  return INDEM.lib;
}
/* active entries → pages; perSquad starts a new page at each squad */
function indemPages(reg, entries, perSquad){
  var act = entries.filter(function(e){ return e.status === "active"; }).sort(function(a, b){
    return String(a.squad).localeCompare(String(b.squad), undefined, { numeric: true }) || (a.last + " " + a.first).localeCompare(b.last + " " + b.first); });
  var pages = [], cur = null;
  act.forEach(function(e){
    var sq = reg.squads && reg.squads[e.squad] ? reg.squads[e.squad].n : (e.squad || "");
    if(!cur || cur.rows.length >= INDEM.rows || (perSquad && cur.squad !== sq)){ cur = { squad: perSquad ? sq : "", rows: [] }; pages.push(cur); }
    cur.rows.push({ member: e.visitor ? "" : String(e.member || ""), name: (String(e.first || "") + " " + String(e.last || "")).trim(), idNumber: String(e.idNumber || ""), cell: String(e.cell || "") });
  });
  pages.push({ squad: perSquad ? "Walk-ins" : "", rows: [], blank: true }); /* spare blank sheet for walk-ins */
  return pages;
}
function indemFit(font, s, size, max){ s = String(s).replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?"); while(s.length && font.widthOfTextAtSize(s, size) > max) s = s.slice(0, -1); return s; }
function indemBuild(reg, entries, perSquad, formBytes){
  return indemLib().then(function(L){
    return Promise.all([L.PDFDocument.create(), L.PDFDocument.load(formBytes)]).then(function(d){
      var out = d[0], src = d[1], pages = indemPages(reg, entries, perSquad);
      return out.embedFont(L.StandardFonts.Helvetica).then(function(font){
        return out.copyPages(src, pages.map(function(){ return 0; })).then(function(cp){
          var white = L.rgb(1, 1, 1), ink = L.rgb(0.05, 0.1, 0.3), rot = L.degrees(90);
          function t(pg, s, x, y, size, max){ s = indemFit(font, s, size, max); if(s) pg.drawText(s, { x: x, y: y, size: size, font: font, color: ink, rotate: rot }); }
          var date = /^\d{4}-\d{2}-\d{2}$/.test(reg.date || "") ? reg.date : "";
          cp.forEach(function(pg, i){
            out.addPage(pg); var p = pages[i];
            if(date){ pg.drawRectangle({ x: 93, y: 155, width: 18.5, height: 202, color: white }); t(pg, date, 106, 160, 10, 195); }
            /* time in / out: white-out the HH:MM placeholders, write the defaults (match may override via reg.timeIn/timeOut) */
            pg.drawRectangle({ x: 93, y: 533, width: 18.5, height: 220, color: white });
            var tin = /^\d{2}:\d{2}$/.test(reg.timeIn || "") ? reg.timeIn : INDEM.timeIn, tout = /^\d{2}:\d{2}$/.test(reg.timeOut || "") ? reg.timeOut : INDEM.timeOut;
            t(pg, tin, 106, 552, 10, 60); t(pg, "–".replace(/./, "-"), 106, 640, 10, 10); t(pg, tout, 106, 678, 10, 60);
            function tick(cx, cy){ var h = 2.6, o = { thickness: 1.3, color: ink }; pg.drawLine(Object.assign({ start: { x: cx - h, y: cy - h }, end: { x: cx + h, y: cy + h } }, o)); pg.drawLine(Object.assign({ start: { x: cx - h, y: cy + h }, end: { x: cx + h, y: cy - h } }, o)); }
            INDEM.boxX.forEach(function(x, k){ tick(x, INDEM.arrY); if(k < INDEM.depN) tick(x, INDEM.depY); });
            var rem = [reg.name, reg.venue, p.squad, "Sheet " + (i + 1) + " of " + pages.length].filter(Boolean).join("  ·  ");
            t(pg, rem, 233, 158, 9, 600);
            p.rows.forEach(function(r, k){ var x = INDEM.rowX(k); t(pg, r.member, x, INDEM.colY.member, 9, 48); t(pg, r.name, x, INDEM.colY.name, 10, 212); if(r.idNumber) t(pg, r.idNumber, x, INDEM.colY.id, 9, 145); if(r.cell) t(pg, r.cell, x, INDEM.colY.cell, 9, 116); });
          });
          return out.save();
        });
      });
    });
  });
}
/* runs on register.html (organiser view, ?m=CODE&org=1) – the scoring app no longer carries the filler */
function indemSlug(s){ return String(s || "registration").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "registration"; }
function indemSave(name, bytes){ var blob = new Blob([bytes], { type: "application/pdf" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 4000); window.__lastIndem = { name: name, size: bytes.length }; }
function indemWithPriv(entries, priv){
  priv = priv || {};
  return (entries || []).map(function(e){ var p = (e.tok && priv[e.tok]) || {}; return Object.assign({}, e, { idNumber: p.idNumber || e.idNumber || "", cell: p.cell || e.cell || "" }); });
}
function indemPrint(reg, entries, perSquad, priv){
  if(!reg) return Promise.resolve();
  return fetch("indemnity-form.pdf").then(function(r){ if(!r.ok) throw new Error("Could not load the indemnity form."); return r.arrayBuffer(); })
    .then(function(b){ return indemBuild(reg, indemWithPriv(entries, priv), perSquad, b); })
    .then(function(bytes){ indemSave(indemSlug(reg.name) + "-indemnity-forms.pdf", bytes); });
}
