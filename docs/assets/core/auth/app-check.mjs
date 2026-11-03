const sdkURL='https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js';
function verificationError() {
  return Object.assign(new Error('Não foi possível verificar este navegador. Confira sua conexão e tente novamente.'),{
    status:503,code:'APP_CHECK_UNAVAILABLE'
  });
}
async function bounded(work,timeoutMs) {
  let timer;
  try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(verificationError()),timeoutMs);})]);}
  finally{clearTimeout(timer);}
}

export function createAppCheckClient({loadModule=()=>import(sdkURL),now=()=>Date.now(),timeoutMs=5000}={}) {
  let mode='off',module,instance,pending,failedUntil=0;
  async function initialize(app,config) {
    mode=config?.mode||'off';
    if(mode==='off')return;
    try {
      if(!['observe','enforce'].includes(mode)||config.provider!=='recaptcha-enterprise'||!config.siteKey)throw verificationError();
      module=await bounded(loadModule(),timeoutMs);
      instance=module.initializeAppCheck(app,{provider:new module.ReCaptchaEnterpriseProvider(config.siteKey),isTokenAutoRefreshEnabled:true});
    }catch{if(mode!=='observe')throw verificationError();}
  }
  async function token() {
    if(mode==='off')return null;
    if(!instance||failedUntil>now()){if(mode==='enforce')throw verificationError();return null;}
    if(!pending)pending=(async()=>{
      await Promise.resolve();
      try {
        const result=await bounded(module.getToken(instance,false),timeoutMs);
        if(typeof result?.token!=='string'||!result.token||result.token.length>8192)throw verificationError();
        return result.token;
      }catch{failedUntil=now()+60000;if(mode==='enforce')throw verificationError();return null;}
      finally{pending=null;}
    })();
    return pending;
  }
  return {initialize,token};
}
