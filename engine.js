/* engine.js – Spectre Qualifier scoring engine (pure, no DOM; runs in the browser and in Node for tests).
   A qualifier is DATA (see qualifiers/*.js). The engine never hard-codes a course.

   Scoring model (Gideon, 22 Nov 2026):
   - Hits are NOT scored per string. For each par check (a stage, or a single string when the course gives
     strings their own par) the RO records only a flag: "within" or "over" par. An optional time may be noted;
     the flag is the decision (a time that disagrees with the flag is a warning, never an override).
   - At the end the whole course's target(s) are tallied once: hits per zone (e.g. inner / outer / miss).
     The zone counts should add up to the course's total rounds; if they do not, that is a warning (not a block).
   - PASS = within par on EVERY par check AND points >= pass.minPoints. Either failing means FAIL, with the reason(s).
   - Time exactly equal to par counts as within par (only "exceeding" par fails). */
(function(root){
  "use strict";
  var SCHEMA = 1;

  function num(v){ return typeof v === "number" && isFinite(v); }
  function r1(v){ return Math.round(v * 100) / 100; }

  /* registry: qualifier configs add themselves with SQEngine.register(cfg) */
  var REG = {};
  function register(cfg){ REG[cfg.id] = cfg; return cfg; }
  function get(id){ return REG[id] || null; }
  function list(){ return Object.keys(REG).map(function(k){ return REG[k]; }); }

  function totalRounds(cfg){ var n = 0; (cfg.stages || []).forEach(function(s){ (s.strings || []).forEach(function(x){ n += x.rounds || 0; }); }); return n; }
  function maxZonePoints(cfg){ return (cfg.zones || []).reduce(function(m, z){ return Math.max(m, z.points || 0); }, 0); }
  function maxPoints(cfg){ return totalRounds(cfg) * maxZonePoints(cfg); }
  function stageRounds(st){ return (st.strings || []).reduce(function(n, x){ return n + (x.rounds || 0); }, 0); }
  function stageLabel(st){ return "Stage " + st.n + (st.title ? " (" + st.title + ")" : ""); }

  /* the list of par decisions the RO must make, in course order.
     parMode "stage": one flag per stage against stage.par (strings' times combined).
     parMode "string": one flag per string against string.par.  key = stage id or string id. */
  function parChecks(cfg){
    var out = [];
    (cfg.stages || []).forEach(function(st){
      if(st.parMode === "string") (st.strings || []).forEach(function(x, i){
        out.push({ key: x.id, stage: st.id, n: st.n, par: x.par, rounds: x.rounds || 0, label: stageLabel(st) + " string " + (i + 1), short: "S" + st.n + "." + (i + 1) });
      });
      else out.push({ key: st.id, stage: st.id, n: st.n, par: st.par, rounds: stageRounds(st), label: stageLabel(st), short: "S" + st.n });
    });
    return out;
  }

  /* structural check of a config. errors = cannot run; warnings = review. runnable needs status "verified" and no errors. */
  function validate(cfg){
    var e = [], w = [], ids = {};
    if(!cfg || typeof cfg !== "object") return { ok: false, runnable: false, errors: ["No config."], warnings: [] };
    if(cfg.schema !== SCHEMA) e.push("schema must be " + SCHEMA + ".");
    if(!cfg.id || !/^[a-z0-9-]{2,40}$/.test(cfg.id)) e.push("id must be 2-40 lower-case letters, digits or dashes.");
    if(!cfg.name) e.push("name is required.");
    if(["verified", "todo"].indexOf(cfg.status) < 0) e.push('status must be "verified" or "todo".');
    var zs = cfg.zones || [];
    if(!zs.length) e.push("At least one scoring zone is required.");
    zs.forEach(function(z){ if(!z.id || ids["z:" + z.id]) e.push("Zone ids must be unique and set."); ids["z:" + z.id] = 1; if(!num(z.points)) e.push("Zone " + z.id + " needs numeric points."); });
    if(zs.length && !zs.some(function(z){ return z.miss; })) w.push("No zone is marked as the miss zone.");
    var st = cfg.stages || [];
    if(!st.length) e.push("At least one stage is required.");
    st.forEach(function(s, i){
      if(!s.id || ids[s.id]) e.push("Stage " + (i + 1) + ": id missing or not unique."); ids[s.id] = 1;
      if(s.n !== i + 1) w.push("Stage " + (i + 1) + ": n is " + s.n + ".");
      if(["stage", "string"].indexOf(s.parMode) < 0) e.push(stageLabel(s) + ': parMode must be "stage" or "string".');
      if(!(s.strings || []).length) e.push(stageLabel(s) + ": needs at least one string.");
      (s.strings || []).forEach(function(x, j){
        if(!x.id || ids[x.id]) e.push(stageLabel(s) + " string " + (j + 1) + ": id missing or not unique."); ids[x.id] = 1;
        if(!(x.rounds >= 1) || Math.floor(x.rounds) !== x.rounds) e.push(stageLabel(s) + " string " + (j + 1) + ": rounds must be a whole number >= 1.");
        if(s.parMode === "string" && !(num(x.par) && x.par > 0)) e.push(stageLabel(s) + " string " + (j + 1) + ": needs a par (s).");
      });
      if(s.parMode === "stage" && !(num(s.par) && s.par > 0)) e.push(stageLabel(s) + ": needs a par (s).");
      if(s.parMode === "string" && num(s.par)){
        var sum = (s.strings || []).reduce(function(a, x){ return a + (x.par || 0); }, 0);
        if(Math.abs(sum - s.par) > 0.001) w.push(stageLabel(s) + ": string pars add up to " + r1(sum) + " s but the stage par is " + s.par + " s (the string pars decide).");
      }
    });
    var p = cfg.pass || {};
    if(!num(p.minPoints)) e.push("pass.minPoints is required.");
    if(p.requireAllWithinPar !== true) w.push("pass.requireAllWithinPar is not true – par is then advisory only.");
    var rounds = totalRounds(cfg), max = maxPoints(cfg);
    if(num(cfg.totalRounds) && cfg.totalRounds !== rounds) e.push("totalRounds says " + cfg.totalRounds + " but the strings add up to " + rounds + ".");
    if(num(cfg.maxPoints) && cfg.maxPoints !== max) e.push("maxPoints says " + cfg.maxPoints + " but rounds x best zone = " + max + ".");
    if(num(p.minPoints) && p.minPoints > max) e.push("pass.minPoints (" + p.minPoints + ") is above the course maximum (" + max + ").");
    if(cfg.status === "todo") w.push("This qualifier is a TODO stub and is not verified – it cannot be used to score.");
    return { ok: !e.length, runnable: !e.length && cfg.status === "verified", errors: e, warnings: w, rounds: rounds, maxPoints: max };
  }

  /* rec = { par: { <checkKey>: { flag: "within"|"over", time?: number } }, hits: { <zoneId>: count } | null }
     → { status: "PASS"|"FAIL"|"INCOMPLETE", points, maxPoints, minPoints, short, rounds, hitsTotal, checks[], overPar[], missing[], reasons[], warnings[] } */
  function evaluate(cfg, rec){
    rec = rec || {}; var par = rec.par || {}, hits = rec.hits || null;
    var checks = parChecks(cfg), rounds = totalRounds(cfg), max = maxPoints(cfg), min = (cfg.pass || {}).minPoints;
    var reasons = [], warnings = [], over = [], missing = [];
    checks.forEach(function(c){
      var r = par[c.key] || {}, flag = r.flag === "within" || r.flag === "over" ? r.flag : "";
      var t = num(r.time) ? r.time : null;
      c.flag = flag; c.time = t;
      if(!flag) missing.push(c.label + " par");
      if(flag === "over") over.push(c);
      if(t !== null && flag){
        if(flag === "within" && t > c.par) warnings.push(c.label + ": time " + t + " s is over par " + c.par + " s but is marked within par.");
        if(flag === "over" && t <= c.par) warnings.push(c.label + ": time " + t + " s is within par " + c.par + " s but is marked over par.");
      }
      if(t !== null && t < 0) warnings.push(c.label + ": negative time.");
    });
    var points = 0, hitsTotal = 0, tallied = !!hits, zoneCounts = {};
    if(tallied){
      (cfg.zones || []).forEach(function(z){
        var v = hits[z.id], n = num(v) ? v : 0;
        if(v != null && !num(v)) warnings.push(z.label + ": not a number, counted as 0.");
        if(n < 0){ warnings.push(z.label + ": negative count, counted as 0."); n = 0; }
        if(Math.floor(n) !== n){ warnings.push(z.label + ": not a whole number."); }
        zoneCounts[z.id] = n; hitsTotal += n; points += n * (z.points || 0);
      });
      if(hitsTotal !== rounds) warnings.push("Hit tally is " + hitsTotal + " but the course is " + rounds + " rounds (" + (hitsTotal < rounds ? (rounds - hitsTotal) + " not accounted for" : (hitsTotal - rounds) + " too many") + "). Recount the target.");
    } else missing.push("target tally");
    points = r1(points);
    var short = num(min) ? Math.max(0, r1(min - points)) : 0;
    var needPar = (cfg.pass || {}).requireAllWithinPar === true;
    over.forEach(function(c){ reasons.push("Over par on " + c.label + (c.time !== null ? " (" + c.time + " s, par " + c.par + " s)" : " (par " + c.par + " s)") + "."); });
    if(tallied && num(min) && points < min) reasons.push("Points short by " + short + " (" + points + " of " + min + " needed).");
    var status;
    if((needPar && over.length) || (tallied && num(min) && points < min)) status = "FAIL";
    else if(missing.length) status = "INCOMPLETE";
    else status = "PASS";
    if(!needPar && over.length) warnings.push("Over par recorded, but this qualifier does not fail on par.");
    if(status === "FAIL" && missing.length) warnings.push("Still to record: " + missing.join(", ") + ".");
    return { status: status, points: points, maxPoints: max, minPoints: min, short: short, rounds: rounds, hitsTotal: hitsTotal, tallied: tallied,
      zones: zoneCounts, checks: checks, overPar: over.map(function(c){ return c.label; }), missing: missing, reasons: reasons, warnings: warnings };
  }


  /* corrections: what changed between two records (par flag / time per check, hit count per zone). Pure; used for the edit history. */
  function diffRecords(cfg, a, b){
    a = a || {}; b = b || {}; var out = [], pa = a.par || {}, pb = b.par || {}, ha = a.hits || null, hb = b.hits || null;
    var fl = function(v){ return v === "within" ? "within par" : v === "over" ? "over par" : "-"; };
    var tm = function(v){ return num(v) ? v + " s" : "-"; };
    parChecks(cfg).forEach(function(c){
      var x = pa[c.key] || {}, y = pb[c.key] || {};
      if((x.flag || "") !== (y.flag || "")) out.push({ key: c.key, what: c.label + " par", from: fl(x.flag), to: fl(y.flag) });
      if((num(x.time) ? x.time : null) !== (num(y.time) ? y.time : null)) out.push({ key: c.key + ".time", what: c.label + " time", from: tm(x.time), to: tm(y.time) });
    });
    (cfg.zones || []).forEach(function(z){
      var x = ha && num(ha[z.id]) ? ha[z.id] : null, y = hb && num(hb[z.id]) ? hb[z.id] : null;
      if(x !== y) out.push({ key: "hits." + z.id, what: z.label + " hits", from: x === null ? "-" : String(x), to: y === null ? "-" : String(y) });
    });
    return out;
  }

  /* defence in depth for every export: drop e-mail / ID / cell style keys at any depth (never logs values) */
  var PII_KEY = /^(email|emails|e-?mail|idno|idnum|idnumber|id_?number|said|rsaid|identity|identitynumber|passport|cell|cellno|cellphone|mobile|phone|tel|telephone|contact|contactno|msisdn|whatsapp|tok|token)$/i;
  function stripPii(o){
    if(Array.isArray(o)) return o.map(stripPii);
    if(o && typeof o === "object"){ var r = {}, k; for(k in o){ if(Object.prototype.hasOwnProperty.call(o, k) && !PII_KEY.test(k.replace(/[\s_-]/g, ""))) r[k] = stripPii(o[k]); } return r; }
    return o;
  }
  /* last check before a file leaves the phone: anything that looks like an e-mail, SA ID (13 digits) or SA cell number */
  function looksPii(text){ return /@[^\s"]+\.[a-z]{2,}/i.test(text) || /(^|[^0-9.])[0-9]{13}([^0-9]|$)/.test(text) || /(\+27|(^|[^0-9.])0)[6-8][0-9][ -]?[0-9]{3}[ -]?[0-9]{4}([^0-9]|$)/.test(text); }

  var api = { SCHEMA: SCHEMA, register: register, get: get, list: list, validate: validate, evaluate: evaluate, parChecks: parChecks, diffRecords: diffRecords,
    totalRounds: totalRounds, maxPoints: maxPoints, stageRounds: stageRounds, stripPii: stripPii, looksPii: looksPii };
  root.SQEngine = api;
  if(typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
