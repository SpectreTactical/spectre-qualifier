/* TODO – NOT VERIFIED. Placeholder for the FBI pistol qualification course.
   Nothing below is course data: stages, rounds, pars, zones and the pass mark must be filled in from an
   official / confirmed source and checked by the Match Director before status is changed to "verified".
   The engine refuses to score a config whose status is "todo". */
SQEngine.register({
  schema: 1,
  id: "fbi-pistol",
  version: "0",
  status: "todo",
  name: "FBI Pistol Qualification (TODO – not verified)",
  short: "FBI Pistol (TODO)",
  source: "TODO: official source not yet confirmed.",
  firearm: "handgun",
  zones: [ { id: "hit", label: "TODO hit zone", points: 1 }, { id: "miss", label: "Miss", points: 0, miss: true } ],
  pass: { minPoints: 1, requireAllWithinPar: true },
  stages: [
    { id: "todo1", n: 1, title: "TODO stage", parMode: "stage", par: 1,
      strings: [ { id: "todo1a", rounds: 1, desc: "TODO – placeholder only, not real course data." } ] }
  ]
});
