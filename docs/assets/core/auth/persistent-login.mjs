async function exchangeFirebaseLogin(user, { exchange, signOut, forceRefresh = false }) {
  try {
    await exchange(await user.getIdToken(forceRefresh));
  } catch (error) {
    if (!["APP_CHECK_REQUIRED", "APP_CHECK_INVALID", "APP_CHECK_UNAVAILABLE"].includes(error.code) && ([401, 403].includes(error.status) || ["auth/user-disabled", "auth/user-token-expired", "auth/invalid-user-token"].includes(error.code))) await signOut();
    throw error;
  }
}
async function restoreFirebaseLogin(auth, options) {
  await auth.authStateReady();
  if (!auth.currentUser) return false;
  await exchangeFirebaseLogin(auth.currentUser, { ...options, forceRefresh: true });
  return true;
}
export {
  exchangeFirebaseLogin,
  restoreFirebaseLogin
};
