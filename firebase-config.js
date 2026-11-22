/* ===================== FIREBASE CONFIG – the qualifier's OWN project =====================
   Filled in 22 Nov 2026 for project spectre-qualifier. Source: Firebase console → (qualifier project) → Project settings → Your apps → Web app → SDK setup → Config.
   Only apiKey, authDomain, projectId and appId are used. These values are not secret; access is controlled by
   firestore.rules + Anonymous Auth (shooters/organiser) and Email/Password (club admins only).
   While these are placeholders, online registration stays switched off and the app scores fully offline.
   Must NOT point at the main Spectre Scoring project (spectre-scoring-5ddda): qualifier data stays separate. */
window.SQ_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAtRqHvJMZWPVVrCDBiI_6QcVZTdmWGNlY",
  authDomain: "spectre-qualifier.firebaseapp.com",
  projectId: "spectre-qualifier",
  appId: "1:545471483553:web:ac47e99800edbc3968aae0"
};
window.SQ_FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.14.1/"; /* modular ESM, loaded only when registration is used */
window.SQ_MAIN_PROJECT = "spectre-scoring-5ddda";
window.sqFirebaseConfig = function(){ return window.SQ_FIREBASE_TEST || window.SQ_FIREBASE_CONFIG; };
window.sqFirebaseReady = function(){ var c = window.sqFirebaseConfig(); return !!c && !/REPLACE_ME/.test(JSON.stringify(c)) && c.projectId !== window.SQ_MAIN_PROJECT; };
/* ========================================================================================= */
