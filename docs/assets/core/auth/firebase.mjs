import { createAppCheckClient } from './app-check.mjs?v=hr-operations-1';
function createFirebaseIdentity(state) {
  const attestation = createAppCheckClient();
  async function firebaseAuth() {
    if (state.auth) return [state.auth, state.authModule];
    if (!state.authPromise) state.authPromise = (async () => {
      const [appModule, authModule] = await Promise.all([import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"), import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js")]);
      const app = appModule.getApps()[0] || appModule.initializeApp(state.session.firebase);
      await attestation.initialize(app,state.session.appCheck);
      const auth = authModule.getAuth(app);
      auth.languageCode = "pt-BR";
      await auth.authStateReady();
      await authModule.setPersistence(auth, authModule.browserLocalPersistence);
      state.auth = auth;
      state.authModule = authModule;
      return [auth, authModule];
    })().catch((error) => {
      state.authPromise = null;
      throw error;
    });
    return state.authPromise;
  }
  return { firebaseAuth, getAppCheckToken: attestation.token };
}
export {
  createFirebaseIdentity
};
