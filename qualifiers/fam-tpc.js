/* Federal Air Marshal Tactical Pistol Course (TPC) – the first qualifier on the Spectre Qualifier engine.
   Source: Chris Christian, "Shooting Illustrated" (2019), as built for the Spectre club shoot of 19 Dec 2026
   (/workspace/tpc-match/spectre-match-fam-tpc-2026-12-19.json). In that source each stage has ONE par = the combined
   time of its strings (Stage 3 is a single string), so every stage uses parMode "stage". */
SQEngine.register({
  schema: 1,
  id: "fam-tpc",
  version: "2019.1",
  status: "verified",
  name: "Federal Air Marshal Tactical Pistol Course",
  short: "FAM TPC",
  source: "Chris Christian, Shooting Illustrated (2019); Spectre club shoot build of 21 Nov 2026.",
  firearm: "handgun",
  distance: "7 yd (6.4 m)",
  target: "FBI QIT-97 bottle (Stage 5: two targets, Stage 6: three targets)",
  shotCold: true,
  totalRounds: 30,
  maxPoints: 150,
  zones: [
    { id: "inner", label: "Inner bottle", points: 5 },
    { id: "outer", label: "Outer bottle", points: 2 },
    { id: "miss",  label: "Miss",         points: 0, miss: true }
  ],
  pass: { minPoints: 135, requireAllWithinPar: true },
  stages: [
    { id: "s1", n: 1, title: "Concealed Draw", parMode: "stage", par: 3.3,
      start: "Handgun loaded and holstered under concealment.",
      strings: [ { id: "s1a", rounds: 1, desc: "Draw from concealment, 1 shot at T1." },
                 { id: "s1b", rounds: 1, desc: "Reholster under concealment; repeat: draw, 1 shot at T1." } ] },
    { id: "s2", n: 2, title: "Double Tap", parMode: "stage", par: 2.7,
      start: "Low ready, loaded.",
      strings: [ { id: "s2a", rounds: 2, desc: "2 shots at T1 from low ready." },
                 { id: "s2b", rounds: 2, desc: "Resume low ready; 2 shots at T1." } ] },
    { id: "s3", n: 3, title: "Six-Shot String", parMode: "stage", par: 3.0,
      start: "Low ready, loaded with 6 rounds.",
      strings: [ { id: "s3a", rounds: 6, desc: "6 shots at T1 from low ready (single string)." } ] },
    { id: "s4", n: 4, title: "Speed Reload", parMode: "stage", par: 6.5,
      start: "Low ready, fully loaded; spare magazine on the person.",
      strings: [ { id: "s4a", rounds: 2, desc: "1 shot at T1, speed reload, 1 shot at T1." },
                 { id: "s4b", rounds: 2, desc: "Resume low ready, fully loaded; repeat." } ] },
    { id: "s5", n: 5, title: "Two-Target Transition", parMode: "stage", par: 3.3,
      start: "Low ready, loaded. T1 and T2 3 yd apart.",
      strings: [ { id: "s5a", rounds: 2, desc: "1 shot on each of T1 and T2 (either order)." },
                 { id: "s5b", rounds: 2, desc: "Resume low ready; 1 shot on each of T1 and T2." } ] },
    { id: "s6", n: 6, title: "Turn and Draw", parMode: "stage", par: 7.0,
      start: "Back to the targets; handgun loaded and holstered under concealment.",
      strings: [ { id: "s6a", rounds: 3, desc: "Turn right, draw, 1 shot on each of T1, T2, T3." },
                 { id: "s6b", rounds: 3, desc: "Reholster, back to targets; turn left, draw, 1 shot on each of T1, T2, T3." } ] },
    { id: "s7", n: 7, title: "Slide-Lock Reload", parMode: "stage", par: 8.0,
      start: "Low ready, 1 round chambered and an empty magazine inserted; spare loaded magazine on the person.",
      strings: [ { id: "s7a", rounds: 2, desc: "1 shot at T1; at slide lock drop to a knee, reload, 1 shot at T1." },
                 { id: "s7b", rounds: 2, desc: "Stand, reset the start load; repeat." } ] }
  ]
});
