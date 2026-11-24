/* app.js – Spectre Qualifier UI (offline-first; data in localStorage "spectreQualifier.v1").
   Flow: Match (pick qualifier, match details, optional online registration) → Shooters (import registrations / walk-ins)
   → Score (per stage: within / over par; at the end: one target tally) → Results (A4 print, PII-free JSON for the archive).
   What is stored on this phone: names, SWPC member numbers, division / PF / category / class / squad, scores.
   Never stored or exported here: e-mail, SA ID numbers, cell numbers, registration edit tokens. */
(function(){
"use strict";
var KEY = "spectreQualifier.v1", REGKEY = "spectreQualifier.reg", E = window.SQEngine;
var CLASSES = [
  ["SSP","Standard Service Pistol","pistol"],["ESP","Enhanced Service Pistol","pistol"],["SCP","Standard Compact Pistol","pistol"],
  ["ECP","Enhanced Compact Pistol","pistol"],["SPP","Standard Subcompact Pistol","pistol"],["EPP","Enhanced Subcompact Pistol","pistol"],
  ["JMB","1911 John Moses Browning","pistol"],
  ["SRR","Standard Service Revolver","revolver"],["ERR","Enhanced Service Revolver","revolver"],["SCR","Standard Compact Revolver","revolver"],["ECR","Enhanced Compact Revolver","revolver"],
  ["SMS","Standard Manual-Action Shotgun","shotgun"],["EMS","Enhanced Manual-Action Shotgun","shotgun"],["SSS","Standard Self-Loading Shotgun","shotgun"],["ESS","Enhanced Self-Loading Shotgun","shotgun"],
  ["MSR","Standard Modern Service Rifle","modern"],["ESR","Enhanced Modern Service Rifle","modern"],["MSC","Standard Modern Service Carbine","modern"],["ESC","Enhanced Modern Service Carbine","modern"],["MCC","Modern Compact Carbine","modern"],
  ["SLR","Standard Legacy Service Rifle","legacy"],["ELR","Enhanced Legacy Service Rifle","legacy"],["SLC","Standard Legacy Service Carbine","legacy"],["ELC","Enhanced Legacy Service Carbine","legacy"],["LCC","Legacy Compact Carbine","legacy"]
].map(function(a){ return { c: a[0], n: a[1], g: a[2] }; });
var CLS = {}; CLASSES.forEach(function(c){ CLS[c.c] = c; }); window.CLS = CLS; /* reg-core regDiscOfCode reads CLS */
var FIREARM_GROUPS = { handgun: ["pistol", "revolver"], shotgun: ["shotgun"], rifle: ["modern", "legacy"] };
var CATS = "Open, Lady, Junior, Senior, Super Senior";

function blank(){ return { app: "spectre-qualifier", v: 1, match: { name: "", date: "", venue: "", qualId: "fam-tpc" }, shooters: [], scores: {}, tab: "match" }; }
var S = blank();
try{ var raw = JSON.parse(localStorage.getItem(KEY) || "null"); if(raw && raw.app === "spectre-qualifier") S = Object.assign(blank(), E.stripPii(raw)); }catch(e){}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(E.stripPii(S))); }catch(e){ toast("Could not save on this phone – storage full?"); } }
var UI = { cur: null, work: null }; /* cur = shooter id open on the Score tab */

var $ = function(id){ return document.getElementById(id); };
var esc = function(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
var md = function(s){ return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); };
function toast(t){ var e = $("toast"); e.textContent = t; e.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(function(){ e.style.display = "none"; }, 2200); }
function uid(){ var r = new Uint32Array(2); crypto.getRandomValues(r); return "sh" + r[0].toString(36) + r[1].toString(36).slice(0, 4); }
function Q(){ return E.get(S.match.qualId) || E.get("fam-tpc"); }
function shName(s){ return (s.first + " " + s.last).trim(); }
function sortedShooters(){ return S.shooters.slice().sort(function(a, b){ return String(a.squad || "~").localeCompare(String(b.squad || "~"), undefined, { numeric: true }) || (a.last + a.first).localeCompare(b.last + b.first); }); }
function resultOf(s){ return E.evaluate(Q(), S.scores[s.id] || {}); }
function fp(n){ return typeof n === "number" ? n.toFixed(1) : n; }
function divLabel(s){ return [s.div, s.pf && Q().firearm !== "shotgun" ? s.pf : ""].filter(Boolean).join(" "); }

function render(){
  var q = Q(); $("hdrQ").textContent = q.short + (S.match.name ? " · " + S.match.name : "");
  Array.prototype.forEach.call(document.querySelectorAll("nav button"), function(b){ b.classList.toggle("on", b.dataset.tab === S.tab); });
  var h = S.tab === "match" ? matchTab() : S.tab === "shooters" ? shootersTab() : S.tab === "score" ? scoreTab() : resultsTab();
  $("app").innerHTML = h; bind();
}
$("nav").onclick = function(e){ var b = e.target.closest("button"); if(!b) return; S.tab = b.dataset.tab; if(S.tab !== "score"){ UI.cur = null; UI.work = null; } save(); render(); window.scrollTo(0, 0); };

/* ------------------------------ Match tab ------------------------------ */
function matchTab(){
  var q = Q(), v = E.validate(q), scored = Object.keys(S.scores).length;
  var h = '<div class="card"><h1>Match</h1>' +
    '<label for="mQual">Qualifier</label><select id="mQual"' + (scored ? " disabled" : "") + '>' + E.list().map(function(c){ var ok = E.validate(c).runnable; return '<option value="' + esc(c.id) + '"' + (c.id === q.id ? " selected" : "") + (ok ? "" : " disabled") + '>' + esc(c.name) + '</option>'; }).join("") + '</select>' +
    (scored ? '<p class="tiny muted">Locked: this match already has scores. Start a new match to change the qualifier.</p>' : "") +
    '<label for="mName">Match name</label><input id="mName" maxlength="120" value="' + esc(S.match.name) + '" placeholder="e.g. Spectre club shoot – FAM TPC">' +
    '<div class="grid2"><div><label for="mDate">Date</label><input id="mDate" type="date" value="' + esc(S.match.date) + '"></div><div><label for="mVenue">Venue</label><input id="mVenue" maxlength="120" value="' + esc(S.match.venue) + '"></div></div></div>';
  h += '<div class="card"><h2>' + esc(q.name) + '</h2><div class="small muted">' + esc([q.distance, q.target].filter(Boolean).join(" · ")) + '</div>' +
    '<div class="small" style="margin-top:6px"><b>' + v.rounds + ' rounds</b> · max <b>' + v.maxPoints + '</b> · pass <b>' + q.pass.minPoints + '</b> and within par on every ' + (E.parChecks(q).length === q.stages.length ? "stage" : "par check") + '<br>Zones: ' + q.zones.map(function(z){ return esc(z.label) + " " + z.points; }).join(" · ") + '</div>' +
    (v.errors.length || v.warnings.length ? '<div class="msg warn small">' + v.errors.concat(v.warnings).map(esc).join("<br>") + '</div>' : "") +
    '<ul class="plain small" style="margin-top:6px">' + q.stages.map(function(st){ return '<li><b>' + st.n + '. ' + esc(st.title) + '</b> · ' + E.stageRounds(st) + ' rds · ' + (st.parMode === "string" ? "par per string: " + st.strings.map(function(x){ return fp(x.par) + " s"; }).join(" / ") : "par " + fp(st.par) + " s" + (st.strings.length > 1 ? " (" + st.strings.length + " strings combined)" : "")) + '</li>'; }).join("") + '</ul>' +
    '<p class="tiny muted">Source: ' + esc(q.source) + '</p></div>';
  h += hostCard(); h += '<div class="card"><h2>Shooter registration (online)</h2><div id="regBox">' + regInner() + '</div></div>';
  h += '<div class="card"><h2>This phone</h2><p class="small muted">Scores live on this phone only. Save a backup file after each squad.</p>' +
    '<div class="grid2"><button type="button" id="bkSave">Save backup file</button><button type="button" id="bkLoad">Load backup file…</button></div>' +
    '<button type="button" class="wide danger" style="margin-top:8px" id="newMatch">New match (clear this phone)…</button><input type="file" id="bkFile" accept=".json,application/json" hidden></div>';
  return h;
}
function bindMatch(){
  var on = function(id, k){ var el = $(id); if(el) el.onchange = function(){ S.match[k] = el.value.trim(); save(); render(); }; };
  on("mName", "name"); on("mDate", "date"); on("mVenue", "venue");
  var qs = $("mQual"); if(qs) qs.onchange = function(){ S.match.qualId = qs.value; save(); render(); };
  $("bkSave").onclick = function(){ var d = E.stripPii({ app: "spectre-qualifier", kind: "backup", v: 1, savedAt: new Date().toISOString(), match: S.match, shooters: S.shooters, scores: S.scores }); download(slug(S.match.name || "qualifier") + "-backup.json", d); };
  $("bkLoad").onclick = function(){ $("bkFile").click(); };
  $("bkFile").onchange = function(){ var f = this.files[0]; if(!f) return; f.text().then(function(t){ var d = JSON.parse(t); if(!d || d.app !== "spectre-qualifier" || d.kind !== "backup") throw new Error("That is not a Spectre Qualifier backup file.");
    return uiConfirm("Replace everything on this phone with the backup \"" + (d.match && d.match.name || "unnamed") + "\" (" + (d.shooters || []).length + " shooters)?", { ok: "Replace" }).then(function(ok){ if(!ok) return; d = E.stripPii(d); S.match = d.match || blank().match; S.shooters = d.shooters || []; S.scores = d.scores || {}; save(); render(); toast("Backup loaded"); }); })
    .catch(function(e){ uiAlert("Could not load the file: " + e.message); }); this.value = ""; };
  $("newMatch").onclick = function(){ uiConfirm("Clear this phone and start a new match? Save a backup file first – this cannot be undone.", { ok: "Clear", danger: true }).then(function(ok){ if(!ok) return; var t = S.tab; S = blank(); S.tab = t; save(); render(); }); };
  hostBind(); regBind();
}

/* ------------------------------ Online registration (organiser side) ------------------------------ */
var REG = { code: "" }, REGRT = { reg: null, entries: [], unsub: [], err: "", code: "", uid: "" }, FBX = null;
var HOSTKEY = "spectreQualifier.host", HOST = { uid: "", email: "", name: "", ok: false, state: "" }, HOSTRT = { msg: "", view: "", busy: false };
try{ Object.assign(REG, JSON.parse(localStorage.getItem(REGKEY) || "{}")); }catch(e){}
try{ Object.assign(HOST, JSON.parse(localStorage.getItem(HOSTKEY) || "{}")); }catch(e){}
function hostSave(){ try{ localStorage.setItem(HOSTKEY, JSON.stringify({ uid: HOST.uid, email: HOST.email, name: HOST.name, ok: HOST.ok, state: HOST.state })); }catch(e){} }
function hostOn(){ return !!(HOST.ok && HOST.uid); }
function hostName(){ return String(HOST.name || HOST.email || "").replace(/@.*$/, "").trim().slice(0, 80); }
function hostUidOf(d){ return String(d && d.hostUid || ""); }
function hostHeldByOther(d, id){ var h = hostUidOf(d); return !!(h && h !== id); }
function isEffectiveHostDoc(d, id){ var h = hostUidOf(d); return !!(d && (h ? h === id : d.createdBy === id)); }
function hostHeldMsg(d){ var n = String(d && d.hostName || "").trim(); return "This already has a main phone" + (n ? " (" + n + ")" : " (another director)") + ". They keep it until they release it. There is no mid-shoot handover."; }
function hostClaimFields(){ return { hostUid: HOST.uid, hostName: hostName(), hostAt: new Date().toISOString() }; }
function hostClearFields(){ return { hostUid: "", hostName: "", hostAt: "" }; }
function hostErr(er){ var c = String(er && er.code || ""); return /invalid-credential|wrong-password|user-not-found|invalid-email/.test(c) ? "That email and password do not match a club login." : /email-already-in-use/.test(c) ? "That email already has a club login – sign in instead." : /weak-password/.test(c) ? "Use a password of at least 8 characters." : (er && er.message || String(er)); }
function hostRefresh(){
  if(!window.sqFirebaseReady()) return Promise.resolve();
  return fbT().then(function(t){
    var u = t.auth.currentUser;
    if(!u || u.isAnonymous){ if(HOST.uid){ HOST = { uid: "", email: "", name: HOST.name || "", ok: false, state: "" }; hostSave(); } return; }
    HOST.uid = u.uid; HOST.email = String(u.email || HOST.email || "");
    return t.isHost(u.uid).then(function(ok){ HOST.ok = !!ok; HOST.state = ok ? "ok" : "waiting"; hostSave(); });
  }).catch(function(){});
}
function hostCard(){
  if(!window.sqFirebaseReady()) return "";
  var h = '<div class="card" id="hostCard"><h2>Match director</h2>', m = HOSTRT.msg ? '<div class="small"><b>' + esc(HOSTRT.msg) + '</b></div>' : "";
  if(HOST.uid){
    return h + '<div>Signed in as <b>' + esc(hostName() || HOST.email) + '</b></div><div class="small muted">' + esc(HOST.state === "ok" ? "This phone is signed in as a match director." : "Signed in, but this account is not on the match director list yet. Ask the club admin to add it in Firestore › hosts.") + '</div>' + m +
      '<p class="small muted">A listed director can take a registration someone else created. This role does not grant access to ID or cell numbers.</p>' +
      '<div class="grid2"><button type="button" id="hostCheck">Check status</button><button type="button" class="danger" id="hostOut">Sign out…</button></div></div>';
  }
  var v = HOSTRT.view;
  h += '<p class="small muted">Sign in with your club email so you can take a registration you did not create. ID and cell numbers stay admin-only.</p>' + m;
  if(v === "in" || v === "new") h += (v === "new" ? '<label>Your name</label><input id="hostNm" maxlength="80" value="' + esc(HOST.name || "") + '">' : "") +
    '<label>Email</label><input id="hostEmail" type="email" autocomplete="username">' +
    '<label>Password' + (v === "new" ? " (8+ characters)" : "") + '</label><input id="hostPw" type="password" autocomplete="' + (v === "new" ? "new-password" : "current-password") + '">' +
    (v === "new" ? '<label>Password again</label><input id="hostPw2" type="password" autocomplete="new-password">' : "") +
    '<div class="grid2" style="margin-top:8px"><button type="button" class="primary" id="hostGo">' + (v === "new" ? "Create login" : "Sign in") + '</button><button type="button" id="hostBack">Cancel</button></div>';
  else h += '<div class="grid2"><button type="button" class="primary" id="hostShowIn">Sign in</button><button type="button" id="hostShowNew">Create a club login</button></div>';
  return h + '</div>';
}
function hostBind(){
  var g = function(p){ HOSTRT.busy = true; return p.then(function(){ HOSTRT.busy = false; render(); }, function(er){ HOSTRT.busy = false; HOSTRT.msg = hostErr(er); render(); }); };
  if($("hostShowIn") || $("hostShowNew")){ ["hostShowIn","hostShowNew"].forEach(function(id){ var b = $(id); if(b) b.onclick = function(){ HOSTRT.view = id === "hostShowIn" ? "in" : "new"; HOSTRT.msg = ""; render(); }; }); }
  if($("hostBack")) $("hostBack").onclick = function(){ HOSTRT.view = ""; HOSTRT.msg = ""; render(); };
  if($("hostCheck")) $("hostCheck").onclick = function(){ HOSTRT.msg = ""; g(hostRefresh().then(function(){ HOSTRT.msg = HOST.state === "ok" ? "This phone is signed in as a match director." : (HOST.state === "waiting" ? "Not on the match director list yet." : "Not signed in."); })); };
  if($("hostOut")) $("hostOut").onclick = function(){ uiConfirm("Sign out as match director?", { ok: "Sign out", danger: true }).then(function(ok){ if(!ok) return; g(fbT().then(function(t){ return t.signOut(); }).then(function(){ HOST = { uid: "", email: "", name: HOST.name || "", ok: false, state: "" }; hostSave(); HOSTRT.view = ""; HOSTRT.msg = "Signed out."; })); }); };
  if($("hostGo")) $("hostGo").onclick = function(){
    var v = HOSTRT.view, email = ($("hostEmail").value || "").trim(), pw = $("hostPw").value || "", nm = v === "new" ? ($("hostNm").value || "").replace(/\s+/g, " ").trim().slice(0, 80) : (HOST.name || "");
    HOSTRT.msg = "";
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ HOSTRT.msg = "Enter your club email address."; return render(); }
    if(v === "new"){
      if(!nm){ HOSTRT.msg = "Type your name."; return render(); }
      if(pw.length < 8){ HOSTRT.msg = "Use a password of at least 8 characters."; return render(); }
      if(pw !== $("hostPw2").value){ HOSTRT.msg = "The two passwords differ."; return render(); }
      return g(fbT().then(function(t){ return t.createPw(email, pw); }).then(function(){ HOST.name = nm; HOST.email = email; return hostRefresh(); }).then(function(){ HOSTRT.view = ""; HOSTRT.msg = HOST.ok ? "Signed in as a match director." : "Login created. Ask the club admin to add this account in Firestore › hosts, then tap Check status."; }));
    }
    if(!pw){ HOSTRT.msg = "Type your password."; return render(); }
    return g(fbT().then(function(t){ return t.signInPw(email, pw); }).then(function(){ if(nm) HOST.name = nm; HOST.email = email; return hostRefresh(); }).then(function(){ HOSTRT.view = ""; HOSTRT.msg = HOST.ok ? "Signed in as a match director." : hostRefresh && (HOST.state === "waiting" ? "Signed in, but not on the match director list yet." : "Signed in."); }));
  };
}
function regSaveLocal(){ try{ localStorage.setItem(REGKEY, JSON.stringify({ code: REG.code })); }catch(e){} }
function fbT(){
  if(!window.sqFirebaseReady()) return Promise.reject(new Error("Online registration is not set up yet: fill in firebase-config.js with the qualifier's own Firebase project."));
  if(FBX) return FBX;
  var cfg = window.sqFirebaseConfig(), base = window.SQ_FIREBASE_SDK;
  FBX = Promise.all([import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")]).then(function(m){
    var app = m[0].initializeApp(cfg), auth = m[1].getAuth(app), F = m[2], db = F.getFirestore(app);
    if(cfg.emulator){ m[1].connectAuthEmulator(auth, "http://" + cfg.emulator + ":9099", { disableWarnings: true }); F.connectFirestoreEmulator(db, cfg.emulator, 8085); }
    return (auth.currentUser ? Promise.resolve(auth.currentUser) : m[1].signInAnonymously(auth).then(function(c){ return c.user; })).then(function(u){
      var t = { F: F, db: db, uid: u.uid, auth: auth };
      t.refreshUid = function(){ t.uid = auth.currentUser ? auth.currentUser.uid : ""; return t.uid; };
      t.isHost = function(id){ return F.getDoc(F.doc(db, "hosts", id)).then(function(d){ return d.exists(); }); };
      t.signInPw = function(email, pw){ return m[1].signInWithEmailAndPassword(auth, email, pw).then(function(c){ t.uid = c.user.uid; return c.user; }); };
      t.createPw = function(email, pw){ return m[1].createUserWithEmailAndPassword(auth, email, pw).then(function(c){ t.uid = c.user.uid; return c.user; }); };
      t.signOut = function(){ return m[1].signOut(auth).then(function(){ return m[1].signInAnonymously(auth); }).then(function(c){ t.uid = c.user.uid; return t.uid; }); };
      return t;
    });
  });
  FBX.catch(function(){ FBX = null; });
  return FBX;
}
function regLink(code){ return new URL("register.html?m=" + code, location.href.split("#")[0].split("?")[0]).href; }
function newCode(){ var c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "", r = new Uint32Array(6); crypto.getRandomValues(r); for(var i = 0; i < 6; i++) s += c[r[i] % c.length]; return s; }
function regWatch(){
  if(!REG.code || (REGRT.code === REG.code && REGRT.unsub.length)) return;
  regUnwatch(); REGRT.code = REG.code;
  fbT().then(function(t){ var F = t.F, db = t.db, code = REG.code;
    REGRT.uid = t.refreshUid ? t.refreshUid() : t.uid;
    var applyReg = function(d){ if(REG.code !== code) return; REGRT.reg = d.exists() ? d.data() : null; REGRT.err = d.exists() ? "" : "No registration with that code."; if($("regBox")) regPaint(); else setTimeout(function(){ if($("regBox")) regPaint(); else if(typeof render === "function") render(); }, 0); };
    F.getDoc(F.doc(db, "regs", code)).then(applyReg, regErr);
    REGRT.unsub.push(F.onSnapshot(F.doc(db, "regs", code), applyReg, regErr));
    REGRT.unsub.push(F.onSnapshot(F.collection(db, "regs", code, "entries"), function(q){ REGRT.entries = q.docs.map(function(d){ var e = d.data(); e.tok = d.id; return e; }); if(REGRT.err && /list its entries|permission/i.test(REGRT.err)) REGRT.err = ""; regPaint(); }, function(e){ REGRT.entries = []; if(/permission/i.test(String(e && e.message))){ REGRT.err = ""; regPaint(); } else regErr(e); }));
  }).catch(regErr);
}
function regUnwatch(){ REGRT.unsub.forEach(function(u){ try{ u(); }catch(e){} }); REGRT.unsub = []; REGRT.code = ""; }
function regErr(e){ REGRT.err = (e && e.message) || String(e); regPaint(); }
function regPaint(){ var b = $("regBox"); if(b){ b.innerHTML = regInner(); regDrawQR(); } }
function regDrawQR(){ var q = $("regQR"); if(q && REG.code && window.qrcode){ try{ var x = qrcode(0, "L"); x.addData(regLink(REG.code), "Byte"); x.make(); q.innerHTML = x.createSvgTag({ cellSize: 4, margin: 4, scalable: true }); }catch(e){} } }
function regFmt(ms){ var d = new Date(ms); return isNaN(d) ? "" : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }); }
function regInner(){
  if(!window.sqFirebaseReady()) return '<p class="small muted">Not set up yet: online registration needs the qualifier\'s own Firebase project (firebase-config.js). Scoring works without it – add shooters on the Shooters tab.</p>';
  if(!REG.code) return '<p class="small muted">Shooters register with one link or QR: name, member number, division, power factor, category, class and squad, plus an optional opt-in ID and cell number for the indemnity form (admins only). Then import them here.</p><button type="button" class="wide primary" id="regNewB">Create a registration…</button><button type="button" class="wide" style="margin-top:8px" id="regOpenB">Open an existing one by code…</button>';
  var r = REGRT.reg;
  if(!r) return '<p class="small">Registration <b>' + esc(REG.code) + '</b> · ' + (REGRT.err ? '<span class="muted">' + esc(REGRT.err) + '</span>' : "loading…") + '</p><button type="button" class="wide" id="regForgetB">Forget on this phone</button>';
  var myUid = REGRT.uid || HOST.uid || "";
  if(!isEffectiveHostDoc(r, myUid) && !REGRT.entries.length){
    var held = hostHeldByOther(r, myUid);
    var h0 = '<div><b>' + esc(r.name) + '</b> · ' + esc(r.date) + ' · code <b>' + esc(REG.code) + '</b></div>';
    if(held) h0 += '<div class="msg warn">' + esc(hostHeldMsg(r)) + '</div>';
    else if(hostOn()) h0 += '<p class="small">This registration was created on another phone and is not claimed yet.</p><button type="button" class="wide primary" id="regTakeB">Take as match director…</button>';
    else h0 += '<p class="small muted">This registration was created on another phone. Sign in as a match director to take it for the day.</p>';
    h0 += '<button type="button" class="wide" style="margin-top:8px" id="regForgetB">Forget on this phone</button>';
    return h0;
  }
  var act = REGRT.entries.filter(function(e){ return e.status === "active"; }), open = regIsOpen(r), cap = 0, link = regLink(REG.code);
  var sq = regSquadIds(r).map(function(id){ var n = act.filter(function(e){ return e.squad === id; }).length; cap += r.squads[id].max; return '<li>' + esc(r.squads[id].n) + ': <b>' + n + '/' + r.squads[id].max + '</b></li>'; }).join("");
  return '<div><b>' + esc(r.name) + '</b> · ' + esc(r.date) + ' · code <b>' + esc(REG.code) + '</b></div>' +
    '<div class="small" style="margin:6px 0">' + (open ? '<b style="color:#1f7a35">Open</b> until ' + esc(regFmt(r.closesMs)) : '<b style="color:#b3261e">Closed</b>') + ' · ' + act.length + '/' + cap + ' entered · ' + act.filter(function(e){ return e.paid; }).length + ' paid' + (REGRT.err ? '<br><span class="muted">' + esc(REGRT.err) + '</span>' : "") + '</div>' +
    '<div class="qr" id="regQR"></div><input id="regLinkI" readonly value="' + esc(link) + '" style="font-size:13px"><div class="grid2" style="margin-top:6px"><button type="button" id="regCopyB">Copy link</button><button type="button" id="regCloseB">' + (r.closed ? "Reopen" : "Close now") + '</button></div>' +
    '<ul class="plain small" style="margin-top:6px">' + sq + '</ul>' +
    '<div class="grid2" style="margin-top:8px"><button type="button" class="primary" id="regImpB"' + (act.length ? "" : " disabled") + '>Import as shooters</button><a href="' + esc(link) + '&amp;org=1" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;border:1px solid #b9c2d3;border-radius:8px;text-align:center;font-size:14px;color:#14284b;text-decoration:none">Indemnity forms (PDF)</a></div>' +
    '<details style="margin-top:10px"><summary>Entries (' + REGRT.entries.length + ')</summary><ul class="plain small">' + REGRT.entries.slice().sort(function(a, b){ return (a.last + a.first).localeCompare(b.last + b.first); }).map(function(e){
      var gone = e.status !== "active"; return '<li class="row" style="' + (gone ? "opacity:.55" : "") + '"><span class="grow"><b>' + esc(e.first + " " + e.last) + '</b>' + (gone ? " · " + esc(e.status) : "") + '<br>' + esc([r.squads[e.squad] ? r.squads[e.squad].n : "", regDivsText(e), e.cat, e.visitor ? "Visitor" : e.member ? "SWPC " + e.member : ""].filter(Boolean).join(" · ")) + '</span>' +
        (gone ? (e.status === "removed" ? '<button type="button" data-regrestore="' + esc(e.tok) + '">Restore</button>' : "") : '<label style="margin:0;font-weight:400"><input type="checkbox" style="width:auto" data-regpaid="' + esc(e.tok) + '"' + (e.paid ? " checked" : "") + '> Paid</label><button type="button" class="danger" data-regdel="' + esc(e.tok) + '">Remove</button>') + '</li>'; }).join("") + '</ul></details>' +
    (hostOn() && hostUidOf(r) === (HOST.uid || "") ? '<button type="button" class="wide" style="margin-top:8px" id="regRelB">Release main phone…</button><p class="tiny muted">Release only if you prepared this registration and another director will run the day.</p>' : "") +
    '<button type="button" class="wide" style="margin-top:10px" id="regForgetB">Forget on this phone</button>';
}
function regBind(){
  var box = $("regBox"); if(!box) return; regDrawQR(); if(REG.code) regWatch();
  box.onchange = function(e){ var c = e.target; if(c.dataset.regpaid) regOrgSet(c.dataset.regpaid, { paid: c.checked }); };
  box.onclick = function(e){ var b = e.target.closest("button"); if(!b) return;
    if(b.id === "regNewB") regForm();
    if(b.id === "regOpenB") uiPrompt("Registration code").then(function(v){ v = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if(!/^[A-Z0-9]{6,8}$/.test(v)) return; regUnwatch(); REG = { code: v }; regSaveLocal(); REGRT.reg = null; regWatch(); regPaint(); });
    if(b.id === "regTakeB") regClaim(REG.code).then(function(){ toast("This phone is the organiser for " + REG.code); regUnwatch(); regWatch(); regPaint(); }).catch(function(e){ uiAlert(e.message); });
    if(b.id === "regRelB") uiConfirm("Release the main phone on registration " + REG.code + "? Another director can then take it.", { ok: "Release" }).then(function(ok){ if(!ok) return; return regRelease().then(function(){ toast("Main phone released"); regPaint(); }); }).catch(function(e){ uiAlert(e.message); });
    if(b.id === "regCopyB"){ var i = $("regLinkI"); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(function(){ toast("Link copied"); }, function(){ toast("Select the link and copy it"); }); }
    if(b.id === "regCloseB") regUpdate({ closed: !REGRT.reg.closed });
    if(b.id === "regImpB") regImport();
    if(b.dataset.regdel){ var en = REGRT.entries.filter(function(x){ return x.tok === b.dataset.regdel; })[0]; uiConfirm("Remove " + en.first + " " + en.last + " from the registration? Their squad slot is freed (you can restore them).", { ok: "Remove", danger: true }).then(function(ok){ if(ok) regOrgSet(en.tok, { status: "removed" }); }); }
    if(b.dataset.regrestore) regOrgSet(b.dataset.regrestore, { status: "active" });
    if(b.id === "regForgetB") uiConfirm("Forget registration " + REG.code + " on this phone? It stays online.", { ok: "Forget" }).then(function(ok){ if(ok){ regUnwatch(); REG = { code: "" }; REGRT.reg = null; REGRT.entries = []; regSaveLocal(); regPaint(); } });
  };
}
function regOrgSet(tok, patch){ return fbT().then(function(t){ return regSaveEntry(t.F, t.db, REG.code, tok, patch, t.uid, true); }).catch(function(e){ uiAlert(e.message); regPaint(); }); }
function regUpdate(patch){ return fbT().then(function(t){ return t.F.setDoc(t.F.doc(t.db, "regs", REG.code), Object.assign({}, REGRT.reg, patch, { updatedAt: regNowISO() })); }).catch(function(e){ uiAlert(e.message); }); }
function regCreate(body){
  var code = newCode();
  return fbT().then(function(t){ var F = t.F, db = t.db;
    return F.getDoc(F.doc(db, "regs", code)).then(function(d){ if(d.exists()) throw new Error("Code clash – try again.");
      var data = Object.assign({ code: code, closed: false, createdBy: t.uid, createdAt: regNowISO() }, body);
      if(hostOn()) Object.assign(data, hostClaimFields());
      return F.setDoc(F.doc(db, "regs", code), data).then(function(){ var b = F.writeBatch(db); Object.keys(data.squads).forEach(function(id){ b.set(F.doc(db, "regs", code, "counts", id), { n: 0, last: "" }); }); return b.commit(); });
    }).then(function(){ REG = { code: code }; regSaveLocal(); REGRT.reg = null; REGRT.entries = []; regUnwatch(); regWatch(); return code; });
  });
}

function regNowISO(){ return new Date().toISOString(); }
function regClaim(code){
  code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if(!/^[A-Z0-9]{6,8}$/.test(code)) return Promise.reject(new Error("Enter the registration code."));
  if(!hostOn()) return Promise.reject(new Error("Sign in as a match director first."));
  return fbT().then(function(t){ return t.F.getDoc(t.F.doc(t.db, "regs", code)).then(function(d){
    if(!d.exists()) throw new Error("No registration " + code + ".");
    var r = d.data();
    if(hostHeldByOther(r, t.uid)) throw new Error(hostHeldMsg(r));
    if(hostUidOf(r) === t.uid){ REG = { code: code }; regSaveLocal(); return code; }
    return t.F.setDoc(t.F.doc(t.db, "regs", code), Object.assign({}, r, hostClaimFields(), { updatedAt: regNowISO() })).then(function(){ REG = { code: code }; regSaveLocal(); return code; });
  }); });
}
function regRelease(){
  if(!REG.code) return Promise.reject(new Error("No registration is open on this phone."));
  if(!hostOn()) return Promise.reject(new Error("Sign in as a match director to release the claim."));
  return fbT().then(function(t){ return t.F.setDoc(t.F.doc(t.db, "regs", REG.code), Object.assign({}, REGRT.reg, hostClearFields(), { updatedAt: regNowISO() })); });
}
function regLocalDT(ms){ var d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); }
function regForm(){
  var q = Q(), groups = FIREARM_GROUPS[q.firearm] || FIREARM_GROUPS.handgun, mdt = S.match.date, close;
  if(mdt){ var dd = new Date(mdt + "T18:00"); dd.setDate(dd.getDate() - 1); close = regLocalDT(dd.getTime()); } else close = regLocalDT(Date.now() + 7 * 864e5).slice(0, 11) + "18:00";
  overlay('<h2>New shooter registration</h2><p class="small muted">For ' + esc(q.name) + '. Shooters get one link / QR. Entries go to the qualifier\'s own database, not the main Spectre Scoring one.</p>' +
    '<label>Match name</label><input id="rgName" maxlength="120" value="' + esc(S.match.name) + '"><div class="grid2"><div><label>Date</label><input id="rgDate" type="date" value="' + esc(mdt) + '"></div><div><label>Venue</label><input id="rgVenue" maxlength="120" value="' + esc(S.match.venue) + '"></div></div>' +
    '<label>Registration closes</label><input id="rgClose" type="datetime-local" value="' + esc(close) + '">' +
    '<label>Divisions shooters can choose</label><div class="small" style="columns:2">' + CLASSES.filter(function(c){ return groups.indexOf(c.g) >= 0; }).map(function(c){ return '<label style="font-weight:400;margin:4px 0"><input type="checkbox" style="width:auto" data-rgdiv="' + c.c + '"' + (c.g === groups[0] ? " checked" : "") + '> ' + c.c + '</label>'; }).join("") + '</div>' +
    '<label>Squads and slots (one per line, "name: slots")</label><textarea id="rgSq" rows="4">Squad 1: 10\nSquad 2: 10</textarea>' +
    '<label>Classes (optional, comma separated)</label><input id="rgCls" placeholder="e.g. A, B, C, D, U">' +
    '<label>Categories (comma separated)</label><input id="rgCats" value="' + esc(CATS) + '">' +
    '<label>Note shown to shooters (optional)</label><textarea id="rgNote" rows="2" maxlength="1000"></textarea>' +
    '<div class="grid2" style="margin-top:12px"><button type="button" id="ovCancel">Cancel</button><button type="button" class="primary" id="rgSave">Create</button></div>');
  $("rgSave").onclick = function(){
    var list = function(v){ return v.split(",").map(function(x){ return x.trim().slice(0, 40); }).filter(Boolean).slice(0, 20); };
    var dv = Array.prototype.filter.call(document.querySelectorAll("[data-rgdiv]"), function(c){ return c.checked; }).map(function(c){ return c.dataset.rgdiv + " – " + CLS[c.dataset.rgdiv].n; });
    var closesMs = new Date($("rgClose").value).getTime(), name = $("rgName").value.trim(), squads = {}, err = "", n = 0;
    $("rgSq").value.split(/\r?\n/).forEach(function(line){ line = line.trim(); if(!line) return; var m = line.match(/^(.*?)[:=\s]\s*(\d+)$/); if(!m){ err = err || 'Squad line "' + line + '" needs a slot number, e.g. "Squad 1: 10".'; return; } squads["S" + (++n)] = { n: m[1].trim().replace(/[:=]$/, "").slice(0, 40) || "Squad", max: Math.min(200, parseInt(m[2], 10)) }; });
    if(!name) err = "Enter the match name."; else if(!dv.length) err = "Tick at least one division."; else if(isNaN(closesMs)) err = "Set the closing date and time."; else if(!n) err = err || "Add at least one squad."; else if(n > 40) err = "At most 40 squads.";
    if(err) return uiAlert(err);
    var disc = {}; disc[q.firearm === "shotgun" ? "shotgun" : q.firearm === "rifle" ? "rifle" : "handgun"] = dv;
    var body = { name: name, date: $("rgDate").value, venue: $("rgVenue").value.trim(), divisions: dv, disc: disc, classes: list($("rgCls").value), cats: list($("rgCats").value), squads: squads, closesMs: closesMs, note: $("rgNote").value.trim().slice(0, 1000), updatedAt: regNowISO(), v: 1, qual: q.id };
    var b = $("rgSave"); b.disabled = true; b.textContent = "Creating…";
    regCreate(body).then(function(code){ closeOverlay(); toast("Registration " + code + " created"); render(); }, function(e){ b.disabled = false; b.textContent = "Create"; uiAlert(e.message); });
  };
}
/* registration entries → shooters. Takes ONLY the scoring fields: never e-mail, ID, cell or the edit token. */
function regToShooters(reg, entries){
  var q = Q(), disc = q.firearm === "shotgun" ? "shotgun" : q.firearm === "rifle" ? "rifle" : "handgun";
  return entries.filter(function(e){ return e.status === "active"; }).map(function(e){
    var d = regEntryDivs(e), f = d[disc] || d[Object.keys(d)[0]] || {};
    return { first: String(e.first || "").slice(0, 60), last: String(e.last || "").slice(0, 60), member: e.visitor ? "" : String(e.member || "").slice(0, 40), visitor: !!e.visitor,
      div: f.d || regDivCode(e.division), pf: f.pf || "", cat: e.cat || "", cls: e.cls || "", squad: reg.squads[e.squad] ? reg.squads[e.squad].n : "", src: "reg" };
  });
}
function sameShooter(a, b){ var k = function(x){ return (x.first + "|" + x.last).toLowerCase().replace(/\s+/g, "") + "|" + String(x.member || "").toLowerCase(); }; return k(a) === k(b); }
function regImport(){
  var list = regToShooters(REGRT.reg, REGRT.entries), added = 0, upd = 0;
  list.forEach(function(n){ var o = S.shooters.filter(function(s){ return sameShooter(s, n); })[0]; if(o){ Object.assign(o, n); upd++; } else { n.id = uid(); S.shooters.push(n); added++; } });
  save(); render(); uiAlert("Registrations imported: " + added + " new shooter(s), " + upd + " updated.");
}

/* ------------------------------ Shooters tab ------------------------------ */
function shootersTab(){
  var list = sortedShooters(), last = null;
  var h = '<div class="card"><div class="row"><h1 class="grow">Shooters (' + list.length + ')</h1><button type="button" class="primary" id="addSh">+ Add shooter</button></div>' +
    (list.length ? "" : '<p class="small muted">No shooters yet. Import them from the online registration (Match tab), or add walk-ins here.</p>') + '<ul class="plain">';
  list.forEach(function(s){ if(s.squad !== last){ last = s.squad; h += '<li class="tiny muted" style="padding-top:12px"><b>' + esc(s.squad || "No squad") + '</b></li>'; }
    var r = resultOf(s); h += '<li class="row"><span class="grow"><b>' + esc(shName(s)) + '</b><br><span class="small muted">' + esc([divLabel(s), s.cat, s.cls, s.visitor ? "Visitor" : s.member ? "SWPC " + s.member : ""].filter(Boolean).join(" · ")) + '</span></span><span class="chip ' + r.status + '">' + r.status + '</span><button type="button" data-edit="' + s.id + '">Edit</button></li>'; });
  return h + '</ul></div>';
}
function shooterForm(s){
  var q = Q(), groups = FIREARM_GROUPS[q.firearm] || FIREARM_GROUPS.handgun, edit = !!s; s = s || { first: "", last: "", member: "", visitor: false, div: "", pf: "minor", cat: "Open", cls: "", squad: "" };
  var squads = {}; S.shooters.forEach(function(x){ if(x.squad) squads[x.squad] = 1; });
  overlay('<h2>' + (edit ? "Edit shooter" : "Add shooter") + '</h2>' +
    '<div class="grid2"><div><label for="fFirst">Name</label><input id="fFirst" maxlength="60" value="' + esc(s.first) + '"></div><div><label for="fLast">Surname</label><input id="fLast" maxlength="60" value="' + esc(s.last) + '"></div></div>' +
    '<label style="font-weight:400"><input type="checkbox" id="fVisitor" style="width:auto"' + (s.visitor ? " checked" : "") + '> Visitor (not a club member)</label>' +
    '<label for="fMember">SWPC member number</label><input id="fMember" maxlength="40" value="' + esc(s.member) + '">' +
    '<label for="fDiv">Division</label><select id="fDiv"><option value="">– choose –</option>' + CLASSES.filter(function(c){ return groups.indexOf(c.g) >= 0; }).map(function(c){ return '<option value="' + c.c + '"' + (s.div === c.c ? " selected" : "") + '>' + c.c + ' – ' + esc(c.n) + '</option>'; }).join("") + '</select>' +
    (q.firearm !== "shotgun" ? '<label>Power factor</label><div class="grid2"><label style="font-weight:400"><input type="radio" name="fPf" value="minor" style="width:auto"' + (s.pf !== "major" ? " checked" : "") + '> Minor</label><label style="font-weight:400"><input type="radio" name="fPf" value="major" style="width:auto"' + (s.pf === "major" ? " checked" : "") + '> Major</label></div>' : "") +
    '<div class="grid2"><div><label for="fCat">Category</label><select id="fCat">' + CATS.split(", ").map(function(c){ return '<option' + (s.cat === c ? " selected" : "") + '>' + c + '</option>'; }).join("") + '</select></div><div><label for="fCls">Class (optional)</label><input id="fCls" maxlength="40" value="' + esc(s.cls) + '"></div></div>' +
    '<label for="fSquad">Squad</label><input id="fSquad" maxlength="40" list="fSqL" value="' + esc(s.squad) + '"><datalist id="fSqL">' + Object.keys(squads).map(function(x){ return '<option value="' + esc(x) + '">'; }).join("") + '</datalist>' +
    '<p class="tiny muted">No e-mail, ID or cell number is kept in this app. Opt-in ID / cell for the indemnity form goes through the online registration only.</p>' +
    '<div class="grid2" style="margin-top:12px"><button type="button" id="ovCancel">Cancel</button><button type="button" class="primary" id="fSave">Save</button></div>' +
    (edit ? '<button type="button" class="wide danger" style="margin-top:10px" id="fDel">Delete shooter</button>' : ""));
  $("fSave").onclick = function(){
    var v = function(id){ return $(id).value.trim(); }, pf = document.querySelector('input[name="fPf"]:checked');
    var n = { first: v("fFirst"), last: v("fLast"), visitor: $("fVisitor").checked, member: $("fVisitor").checked ? "" : v("fMember"), div: v("fDiv"), pf: q.firearm === "shotgun" ? "" : (pf ? pf.value : "minor"), cat: v("fCat"), cls: v("fCls"), squad: v("fSquad") };
    if(!n.first && !n.last) return uiAlert("Enter the shooter's name.");
    var warn = []; if(!n.div) warn.push("No division chosen."); if(!n.visitor && !n.member) warn.push("No member number (tick Visitor if they are not a member).");
    if(S.shooters.some(function(x){ return x !== s && sameShooter(x, n); })) warn.push("A shooter with this name and member number is already on the list.");
    if(E.looksPii(JSON.stringify(n))) return uiAlert("That looks like an e-mail, ID or cell number. Those are not kept in this app – please remove it.");
    (warn.length ? uiConfirm(warn.join(" ") + " Save anyway?") : Promise.resolve(true)).then(function(ok){ if(!ok) return;
      if(edit) Object.assign(s, n); else { n.id = uid(); n.src = "walkin"; S.shooters.push(n); }
      save(); closeOverlay(); render(); toast(edit ? "Saved" : "Shooter added"); });
  };
  if(edit) $("fDel").onclick = function(){ uiConfirm("Delete " + shName(s) + (S.scores[s.id] ? " and their score" : "") + "?", { ok: "Delete", danger: true }).then(function(ok){ if(!ok) return; S.shooters = S.shooters.filter(function(x){ return x !== s; }); delete S.scores[s.id]; save(); closeOverlay(); render(); }); };
}

/* ------------------------------ Score tab ------------------------------ */
function scoreTab(){
  var q = Q();
  if(!E.validate(q).runnable) return '<div class="card msg err">' + esc(q.name) + ' is not verified and cannot be scored.</div>';
  var s = UI.cur && S.shooters.filter(function(x){ return x.id === UI.cur; })[0];
  if(!s){
    var list = sortedShooters(), last = null, h = '<div class="card"><h1>Score</h1><p class="small muted">Tap a shooter. Per stage, record only <b>within par</b> or <b>over par</b>. Count the target(s) once at the end.</p><ul class="plain">';
    if(!list.length) h += '<li class="small muted">No shooters yet – add them on the Shooters tab.</li>';
    list.forEach(function(x){ if(x.squad !== last){ last = x.squad; h += '<li class="tiny muted" style="padding-top:12px"><b>' + esc(x.squad || "No squad") + '</b></li>'; }
      var r = resultOf(x); h += '<li class="row" data-sh="' + x.id + '" style="cursor:pointer"><span class="grow"><b>' + esc(shName(x)) + '</b><br><span class="small muted">' + esc(divLabel(x)) + (r.tallied ? " · " + r.points + " pts" : "") + (S.scores[x.id] && S.scores[x.id].saved ? " · saved" + (S.scores[x.id].corrected ? ", corrected" : "") : "") + '</span></span><span class="chip ' + r.status + '">' + r.status + '</span></li>'; });
    return h + '</ul></div>';
  }
  var saved = S.scores[s.id], corr = !!(UI.work && UI.work.id === s.id), rec = corr ? UI.work.rec : (saved || { par: {}, hits: null });
  var locked = !!(saved && saved.saved) && !corr, D = locked ? " disabled" : "", r = E.evaluate(q, rec);
  var h2 = '<div class="card"><div class="row"><button type="button" id="scBack">‹ List</button><div class="grow"><b>' + esc(shName(s)) + '</b><br><span class="small muted">' + esc([divLabel(s), s.cat, s.squad].filter(Boolean).join(" · ")) + '</span></div></div>' +
    (corr ? '<div class="msg warn small"><b>Correcting a saved result.</b> Change what is needed, then tap Save correction. Every change is kept in the edit history.</div>' : locked ? '<div class="small muted" style="margin-top:6px">Saved ' + esc(fmtDT(saved.saved)) + (saved.corrected ? ' · corrected ' + esc(fmtDT(saved.corrected)) : "") + '</div>' : "") + banner(r) + histHTML(saved) + '</div>';
  h2 += '<div class="card"><h2>Par time – every stage</h2><p class="tiny muted">The flag decides. A time is optional (a time that disagrees with the flag shows a warning). Exactly on par counts as within par.</p>';
  E.parChecks(q).forEach(function(c){
    var st = q.stages.filter(function(x){ return x.id === c.stage; })[0], pr = (rec.par || {})[c.key] || {};
    h2 += '<div class="stage" data-key="' + c.key + '"><div class="hd"><b>' + esc(c.label) + '</b><span class="tiny muted">' + c.rounds + ' rds</span><span class="par">par ' + fp(c.par) + ' s</span></div>' +
      '<details><summary>Procedure</summary><div class="small">' + (st.start ? '<div><i>' + md(st.start) + '</i></div>' : "") + '<ol style="margin:4px 0 0 18px;padding:0">' + st.strings.map(function(x){ return '<li>' + md(x.desc || "") + ' (' + x.rounds + ' rd' + (x.rounds > 1 ? "s" : "") + ')</li>'; }).join("") + '</ol></div></details>' +
      '<div class="seg"><button type="button" class="within' + (pr.flag === "within" ? " on" : "") + '" data-flag="within"' + D + '>Within par</button><button type="button" class="over' + (pr.flag === "over" ? " on" : "") + '" data-flag="over"' + D + '>Over par</button><input type="number" inputmode="decimal" step="0.01" min="0" placeholder="time s" value="' + (pr.time != null ? esc(pr.time) : "") + '" data-time="1" aria-label="Time (optional)"' + D + '></div></div>';
  });
  h2 += '</div><div class="card"><h2>Target tally – whole course</h2><p class="tiny muted">Count all ' + r.rounds + ' rounds once, after the last stage.</p>';
  q.zones.forEach(function(z){ var n = rec.hits && rec.hits[z.id] != null ? rec.hits[z.id] : ""; h2 += '<div class="zone"><span><b>' + esc(z.label) + '</b><br><span class="tiny muted">' + z.points + ' pts each</span></span><button type="button" data-dz="' + z.id + '" data-d="-1"' + D + '>−</button><input type="number" inputmode="numeric" min="0" step="1" data-zone="' + z.id + '" value="' + esc(n) + '"' + D + '><button type="button" data-dz="' + z.id + '" data-d="1"' + D + '>+</button></div>'; });
  var missZ = q.zones.filter(function(z){ return z.miss; })[0];
  h2 += '<div class="small" id="tallyLine">' + tallyLine(r) + '</div>' + (missZ && !locked ? '<button type="button" class="wide" style="margin-top:8px" id="restMiss">Rest are misses</button>' : "") + '</div>';
  var i = sortedShooters().map(function(x){ return x.id; }).indexOf(s.id), nx = sortedShooters()[i + 1];
  h2 += '<div class="card" id="bot">' + banner(r) + '<div class="grid2">' +
    (corr ? '<button type="button" id="scCancelCorr">Cancel correction</button><button type="button" class="primary" id="scSaveCorr">Save correction</button>'
     : locked ? '<button type="button" id="scCorrect">Correct this result…</button><button type="button" class="primary" id="scNext">' + (nx ? "Next: " + esc(shName(nx)) : "Done") + '</button>'
     : '<button type="button" id="scClear" class="danger"' + (saved ? "" : " disabled") + '>Clear this score…</button><button type="button" class="primary" id="scSave">Save result</button>') + '</div></div>';
  return h2;
}
function fmtDT(iso){ var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
/* edit history of a saved result: [{ at, changes: [{ what, from, to }] }] – kept on the phone and in backups, never in the archive export */
function histHTML(rec){
  var h = rec && rec.history || []; if(!h.length) return "";
  return '<div class="hist small" style="margin-top:8px"><b>Corrections (' + h.length + ')</b><ul style="margin:4px 0 0 18px;padding:0">' + h.map(function(e){ return '<li>' + esc(fmtDT(e.at)) + ': ' + e.changes.map(function(c){ return esc(c.what) + " " + esc(c.from) + " → " + esc(c.to); }).join("; ") + (e.result ? ' <b>(' + esc(e.result) + ')</b>' : "") + '</li>'; }).join("") + '</ul></div>';
}
function tallyLine(r){ return r.tallied ? 'Counted <b>' + r.hitsTotal + '</b> of ' + r.rounds + ' rounds · <b>' + r.points + '</b> / ' + r.maxPoints + ' pts (pass ' + r.minPoints + ')' : 'Not counted yet.'; }
function banner(r){
  var t = r.status === "PASS" ? "PASS" : r.status === "FAIL" ? "FAIL" : "Not finished";
  var items = r.reasons.map(function(x){ return '<li>' + esc(x) + '</li>'; }).concat(r.warnings.map(function(x){ return '<li>⚠ ' + esc(x) + '</li>'; }));
  if(r.status === "INCOMPLETE") items.unshift('<li>Still to record: ' + esc(r.missing.join(", ")) + '</li>');
  return '<div class="banner ' + r.status + '">' + t + (r.tallied ? " · " + r.points + " pts" : "") + (items.length ? '<ul>' + items.join("") + '</ul>' : "") + '</div>';
}
function clone(o){ return JSON.parse(JSON.stringify(o || {})); }
function bindScore(){
  Array.prototype.forEach.call(document.querySelectorAll("[data-sh]"), function(li){ li.onclick = function(){ UI.cur = li.dataset.sh; UI.work = null; render(); window.scrollTo(0, 0); }; });
  if(!UI.cur) return;
  var s = S.shooters.filter(function(x){ return x.id === UI.cur; })[0]; if(!s) return;
  var q = Q(), corr = !!(UI.work && UI.work.id === s.id), rec;
  if(corr) rec = UI.work.rec; else rec = S.scores[s.id] = S.scores[s.id] || { par: {}, hits: null };
  /* a correction edits a working copy; nothing changes in the saved result until "Save correction" */
  var stamp = function(){ if(!corr){ rec.updatedAt = new Date().toISOString(); save(); } refresh(); };
  function refresh(){ var r = E.evaluate(q, rec); Array.prototype.forEach.call(document.querySelectorAll(".banner"), function(b){ b.outerHTML = banner(r); }); var tl = $("tallyLine"); if(tl) tl.innerHTML = tallyLine(r); }
  $("scBack").onclick = function(){ if(UI.work) toast("Correction not saved"); UI.work = null; UI.cur = null; render(); };
  Array.prototype.forEach.call(document.querySelectorAll(".stage"), function(box){
    var k = box.dataset.key;
    Array.prototype.forEach.call(box.querySelectorAll("[data-flag]"), function(b){ b.onclick = function(){ rec.par = rec.par || {}; var p = rec.par[k] = rec.par[k] || {}; p.flag = p.flag === b.dataset.flag ? "" : b.dataset.flag; if(!p.flag) delete p.flag;
      box.querySelectorAll("[data-flag]").forEach(function(x){ x.classList.toggle("on", x.dataset.flag === p.flag); }); stamp(); }; });
    var ti = box.querySelector("[data-time]"); ti.onchange = function(){ rec.par = rec.par || {}; var p = rec.par[k] = rec.par[k] || {}, v = parseFloat(String(ti.value).replace(",", ".")); if(isFinite(v)) p.time = Math.round(v * 100) / 100; else delete p.time; stamp(); };
  });
  function setZ(id, v){ rec.hits = rec.hits || {}; q.zones.forEach(function(z){ if(rec.hits[z.id] == null) rec.hits[z.id] = 0; }); rec.hits[id] = Math.max(0, v); var inp = document.querySelector('[data-zone="' + id + '"]'); if(inp) inp.value = rec.hits[id]; q.zones.forEach(function(z){ var e = document.querySelector('[data-zone="' + z.id + '"]'); if(e && e.value === "") e.value = rec.hits[z.id]; }); stamp(); }
  Array.prototype.forEach.call(document.querySelectorAll("[data-zone]"), function(inp){ inp.onchange = function(){ var v = parseInt(inp.value, 10); setZ(inp.dataset.zone, isFinite(v) ? v : 0); }; });
  Array.prototype.forEach.call(document.querySelectorAll("[data-dz]"), function(b){ b.onclick = function(){ var id = b.dataset.dz, cur = rec.hits && rec.hits[id] ? rec.hits[id] : 0; setZ(id, cur + (+b.dataset.d)); }; });
  var rm = $("restMiss"); if(rm) rm.onclick = function(){ var mz = q.zones.filter(function(z){ return z.miss; })[0], tot = E.totalRounds(q), other = 0; q.zones.forEach(function(z){ if(z !== mz) other += rec.hits && rec.hits[z.id] || 0; }); setZ(mz.id, Math.max(0, tot - other)); };
  var b;
  if((b = $("scClear"))) b.onclick = function(){ uiConfirm("Clear " + shName(s) + "'s score?", { ok: "Clear", danger: true }).then(function(ok){ if(ok){ delete S.scores[s.id]; save(); render(); } }); };
  if((b = $("scSave"))) b.onclick = function(){ var r = E.evaluate(q, rec);
    (r.status === "INCOMPLETE" ? uiConfirm("Not finished – still to record: " + r.missing.join(", ") + ". Save anyway?", { ok: "Save" }) : Promise.resolve(true)).then(function(ok){ if(!ok) return;
      rec.saved = new Date().toISOString(); save(); render(); toast("Result saved"); }); };
  if((b = $("scNext"))) b.onclick = function(){ var l = sortedShooters(), i = l.map(function(x){ return x.id; }).indexOf(s.id); UI.cur = l[i + 1] ? l[i + 1].id : null; render(); window.scrollTo(0, 0); };
  if((b = $("scCorrect"))) b.onclick = function(){ uiConfirm("Correct " + shName(s) + "'s saved result? You can change any stage's par flag or time and the hit tally. Each change is recorded in the edit history.", { ok: "Correct" }).then(function(ok){ if(!ok) return; UI.work = { id: s.id, rec: clone({ par: S.scores[s.id].par, hits: S.scores[s.id].hits }) }; render(); }); };
  if((b = $("scCancelCorr"))) b.onclick = function(){ UI.work = null; render(); toast("Correction cancelled"); };
  if((b = $("scSaveCorr"))) b.onclick = function(){
    var sv = S.scores[s.id], ch = E.diffRecords(q, sv, rec);
    if(!ch.length){ UI.work = null; render(); toast("No changes"); return; }
    var before = E.evaluate(q, sv).status, after = E.evaluate(q, rec).status;
    uiConfirm("Save " + ch.length + " change" + (ch.length > 1 ? "s" : "") + " to " + shName(s) + "?\n" + ch.map(function(c){ return "• " + c.what + ": " + c.from + " → " + c.to; }).join("\n") + (before !== after ? "\nResult: " + before + " → " + after : ""), { ok: "Save correction" }).then(function(ok){ if(!ok) return;
      var at = new Date().toISOString();
      sv.par = rec.par || {}; sv.hits = rec.hits || null; sv.updatedAt = at; sv.corrected = at;
      (sv.history = sv.history || []).push({ at: at, changes: ch.map(function(c){ return { what: c.what, from: c.from, to: c.to }; }), result: before !== after ? before + " → " + after : "" });
      UI.work = null; save(); render(); toast("Correction saved"); });
  };
}

/* ------------------------------ Results tab ------------------------------ */
function resultsTab(){
  var q = Q(), checks = E.parChecks(q), list = sortedShooters(), rows = list.map(function(s){ return { s: s, r: resultOf(s) }; });
  var n = { PASS: 0, FAIL: 0, INCOMPLETE: 0 }; rows.forEach(function(x){ n[x.r.status]++; });
  var h = '<div class="card"><h1>Results</h1><div class="small">' + n.PASS + ' pass · ' + n.FAIL + ' fail · ' + n.INCOMPLETE + ' not finished</div>' +
    '<div class="grid2" style="margin-top:10px"><button type="button" class="primary" id="prB"' + (rows.length ? "" : " disabled") + '>Print A4 results</button><button type="button" id="jsB"' + (rows.length ? "" : " disabled") + '>Export results (JSON)</button></div>' +
    '<p class="tiny muted">The JSON is for the Spectre archive: names, division, category, par flags, hit tally and result. No e-mail, ID or cell numbers.</p></div>';
  h += '<div class="card" style="overflow-x:auto"><table class="res"><tr><th class="l">Shooter</th>' + checks.map(function(c){ return '<th>' + c.short + '</th>'; }).join("") + '<th>Pts</th><th></th></tr>' +
    rows.map(function(x){ var r = x.r; return '<tr><td class="l"><b>' + esc(shName(x.s)) + '</b><br><span class="tiny muted">' + esc([x.s.div, x.s.cat].filter(Boolean).join(" · ")) + '</span>' + (S.scores[x.s.id] && S.scores[x.s.id].corrected ? '<br><span class="tiny" style="color:#8a5a00">corrected ' + esc(fmtDT(S.scores[x.s.id].corrected)) + '</span>' : "") + '</td>' + r.checks.map(function(c){ return '<td style="color:' + (c.flag === "over" ? "#b3261e;font-weight:700" : "#1f7a35") + '">' + (c.flag === "over" ? "OVER" : c.flag === "within" ? "✓" : "–") + '</td>'; }).join("") + '<td><b>' + (r.tallied ? r.points : "–") + '</b></td><td><span class="chip ' + r.status + '">' + (r.status === "INCOMPLETE" ? "…" : r.status) + '</span></td></tr>'; }).join("") + '</table></div>';
  return h;
}
function printSheet(){
  var q = Q(), checks = E.parChecks(q), rows = sortedShooters().map(function(s){ return { s: s, r: resultOf(s) }; });
  var h = '<h1>' + esc(S.match.name || q.name) + '</h1><div class="sub">' + esc([q.name, S.match.date, S.match.venue].filter(Boolean).join(" · ")) + '<br>' +
    q.zones.map(function(z){ return esc(z.label) + " " + z.points; }).join(" / ") + ' · ' + E.totalRounds(q) + ' rounds · max ' + E.maxPoints(q) + ' · <b>PASS = ' + q.pass.minPoints + '+ points AND within par on every stage</b></div>' +
    '<table><tr><th>#</th><th class="l">Name</th><th class="l">Division / category</th>' + checks.map(function(c){ return '<th>' + c.short + '<br><span style="font-weight:400">' + fp(c.par) + 's</span></th>'; }).join("") +
    q.zones.map(function(z){ return '<th>' + esc(z.label.split(" ")[0]) + '</th>'; }).join("") + '<th>Pts</th><th>Result</th></tr>';
  rows.forEach(function(x, i){ var r = x.r, sc = S.scores[x.s.id] || {}, why = (sc.history && sc.history.length ? ["Corrected " + sc.history.map(function(e){ return fmtDT(e.at); }).join(", ")] : []).concat(r.reasons).concat(r.status === "INCOMPLETE" ? ["Not finished: " + r.missing.join(", ")] : []).concat(r.warnings.map(function(w){ return "⚠ " + w; }));
    h += '<tr><td>' + (i + 1) + '</td><td class="l"><b>' + esc(shName(x.s)) + '</b></td><td class="l">' + esc([divLabel(x.s), x.s.cat, x.s.cls].filter(Boolean).join(" · ")) + '</td>' +
      r.checks.map(function(c){ return '<td class="' + (c.flag === "over" ? "o" : "") + '">' + (c.flag === "over" ? "OVER" : c.flag === "within" ? "✓" : "–") + (c.time != null ? '<br><span style="font-size:7pt">' + c.time + '</span>' : "") + '</td>'; }).join("") +
      q.zones.map(function(z){ return '<td>' + (r.tallied ? r.zones[z.id] : "–") + '</td>'; }).join("") + '<td><b>' + (r.tallied ? r.points : "–") + '</b></td><td class="R">' + (r.status === "INCOMPLETE" ? "DNF" : r.status) + '</td></tr>' +
      (why.length ? '<tr><td></td><td colspan="' + (4 + checks.length + q.zones.length) + '" class="why">' + why.map(esc).join(" · ") + '</td></tr>' : ""); });
  h += '</table><div class="foot">✓ within par · OVER = over par (fails the course) · DNF = not finished. Printed ' + esc(new Date().toLocaleString("en-ZA")) + '. RO / MD signature: ______________________</div>';
  $("printArea").innerHTML = h; window.print();
}
/* archive record = the same shape as the Spectre archive's records { id, idx: archive/{id}, data: archive/{id}/data/main JSON }.
   kind:"qualifier" on both: the archive lists it with the club shoots but never counts it in the season standings.
   No e-mail, ID, cell or member numbers; the correction history stays on this phone. createdBy is filled in by the publisher. */
function resultsJSON(){
  var q = Q(), checks = E.parChecks(q), at = new Date().toISOString(), date = /^\d{4}-\d{2}-\d{2}$/.test(S.match.date || "") ? S.match.date : at.slice(0, 10);
  var id = ("Q" + date.replace(/-/g, "") + String(q.id).toUpperCase().replace(/[^A-Z0-9]/g, "")).slice(0, 20);
  var name = S.match.name || (q.short + " qualifier"), list = sortedShooters();
  var data = { v: 1, kind: "qualifier", publishedAt: at, match: { name: name, date: date, venue: S.match.venue || "" },
    qualifier: { id: q.id, version: q.version, name: q.name, short: q.short, rounds: E.totalRounds(q), maxPoints: E.maxPoints(q), minPoints: q.pass.minPoints,
      zones: q.zones.map(function(z){ return { id: z.id, label: z.label, points: z.points }; }), checks: checks.map(function(c){ return { key: c.key, label: c.label, par: c.par }; }) },
    results: list.map(function(s){ var r = resultOf(s);
      return { name: shName(s), division: s.div || "", pf: s.pf || "", category: s.cat || "", class: s.cls || "", squad: s.squad || "",
        status: r.status, points: r.tallied ? r.points : null, hits: r.tallied ? r.zones : null, par: r.checks.map(function(c){ return { key: c.key, flag: c.flag || null, time: c.time }; }), reasons: r.reasons }; }),
    sheets: [], stages: [] };
  return E.stripPii({ app: "spectre-qualifier", kind: "qualifier-results", schema: 2, exportedAt: at, id: id,
    idx: { v: 1, kind: "qualifier", matchName: name, date: date, venue: S.match.venue || "", publishedAt: at, hidden: false, createdBy: "", shooters: list.length, stages: checks.length },
    data: data });
}
function bindResults(){
  var p = $("prB"); if(p) p.onclick = printSheet;
  var j = $("jsB"); if(j) j.onclick = function(){ download(slug(S.match.name || Q().short) + "-results.json", resultsJSON()); };
}

/* ------------------------------ helpers ------------------------------ */
function slug(s){ return String(s || "qualifier").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "qualifier"; }
function download(name, obj){
  var text = JSON.stringify(obj, null, 1);
  if(E.looksPii(text)) return uiAlert("Not saved: the file seems to contain an e-mail, ID or cell number. Check the shooter list for one typed into a name, member or class field.");
  var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 4000); window.__lastDownload = { name: name, text: text }; toast("Saved " + name);
}
function overlay(html){ var o = document.createElement("div"); o.className = "ov"; o.id = "ov"; o.innerHTML = "<div>" + html + "</div>"; document.body.appendChild(o); var c = $("ovCancel"); if(c) c.onclick = closeOverlay; window.scrollTo(0, 0); }
function closeOverlay(){ var o = $("ov"); if(o) o.remove(); }
function bind(){ if(S.tab === "match") bindMatch(); else if(S.tab === "shooters"){ $("addSh").onclick = function(){ shooterForm(null); }; Array.prototype.forEach.call(document.querySelectorAll("[data-edit]"), function(b){ b.onclick = function(){ shooterForm(S.shooters.filter(function(x){ return x.id === b.dataset.edit; })[0]); }; }); } else if(S.tab === "score") bindScore(); else bindResults(); }

/* service worker: offline + "Update available – Reload" (the running version is kept until Reload) */
if("serviceWorker" in navigator && location.protocol !== "file:"){
  navigator.serviceWorker.register("sw.js").then(function(reg){
    function ready(w){ $("upd").style.display = "block"; $("updB").onclick = function(){ w.postMessage("skipWaiting"); }; }
    if(reg.waiting && navigator.serviceWorker.controller) ready(reg.waiting);
    reg.addEventListener("updatefound", function(){ var w = reg.installing; w.addEventListener("statechange", function(){ if(w.state === "installed" && navigator.serviceWorker.controller) ready(w); }); });
    setInterval(function(){ reg.update().catch(function(){}); }, 30 * 60000);
  }).catch(function(){});
  var reloaded = false; navigator.serviceWorker.addEventListener("controllerchange", function(){ if(reloaded || !$("upd").style.display || $("upd").style.display === "none") return; reloaded = true; location.reload(); });
}
function regLoadNow(){ if(!REG.code) return Promise.resolve(null); return fbT().then(function(t){ REGRT.uid = t.refreshUid ? t.refreshUid() : t.uid; return t.F.getDoc(t.F.doc(t.db, "regs", REG.code)).then(function(d){ REGRT.reg = d.exists() ? d.data() : null; REGRT.err = d.exists() ? "" : "No registration with that code."; if(typeof render === "function") render(); else regPaint(); return REGRT.reg; }); }); }
window.SQAPP = { get state(){ return S; }, evaluate: function(id){ var s = S.shooters.filter(function(x){ return x.id === id; })[0]; return s ? resultOf(s) : null; }, resultsJSON: resultsJSON, reg: function(){ return { REG: REG, REGRT: REGRT, create: regCreate, loadNow: regLoadNow, open: function(code){ code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if(!/^[A-Z0-9]{6,8}$/.test(code)) return Promise.reject(new Error("Enter the registration code.")); regUnwatch(); REG = { code: code }; regSaveLocal(); REGRT.reg = null; REGRT.entries = []; regWatch(); if(typeof render === "function") render(); else regPaint(); return Promise.resolve(code); } }; }, host: { get state(){ return HOST; }, on: hostOn, refresh: hostRefresh, claim: regClaim, release: regRelease } };
if(window.sqFirebaseReady()) hostRefresh().then(function(){ if(S.tab === "match") render(); });
render();
})();
