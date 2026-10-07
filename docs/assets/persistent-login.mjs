// Firebase owns persistent identity; application session tokens stay in memory.
export async function exchangeFirebaseLogin(user,{exchange,signOut,forceRefresh=false}){
  try{
    await exchange(await user.getIdToken(forceRefresh));
  }catch(error){
    if([401,403].includes(error.status)||['auth/user-disabled','auth/user-token-expired','auth/invalid-user-token'].includes(error.code))await signOut();
    throw error;
  }
}
export async function restoreFirebaseLogin(auth,options){
  await auth.authStateReady();
  if(!auth.currentUser)return false;
  await exchangeFirebaseLogin(auth.currentUser,{...options,forceRefresh:true});
  return true;
}
