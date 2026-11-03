function createAPIClient({ state, baseURL, demoClient, syncTime }) {
  const external = Boolean(baseURL && new URL(baseURL).origin !== location.origin);
  let sessionToken = null;
  let appCheckTokenProvider = async () => null;
  let restoreSession = async () => false;
  let onSessionExpired = () => {
  };
  function requestURL(path) {
    return new URL(path, baseURL || document.baseURI).href;
  }
  function requestOptions(options = {}) {
    const headers = { ...options.headers };
    if (external) {
      headers["X-Ponto-Client"] = "web";
      if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    }
    return {
      ...options,
      headers,
      credentials: external ? "omit" : "same-origin",
      ...external ? { redirect: "error" } : {}
    };
  }
  function acceptResult(result, action) {
    if (result.csrf && state.session) state.session.csrf = result.csrf;
    if (action === "login" && external && result.sessionToken) sessionToken = result.sessionToken;
    syncTime(result.serverTime);
    return result;
  }
  function responseError(response,result,message) {
    const seconds=Number(result.retryAfterSeconds||response.headers.get('Retry-After'));
    return Object.assign(new Error(result.error||message),{status:response.status,code:result.code,
      ...(response.status===429&&Number.isInteger(seconds)&&seconds>0&&seconds<=3600?{retryAfterSeconds:seconds}:{})});
  }
  async function attestedOptions(action,options) {
    if(['session','logout'].includes(action))return options;
    const token=await appCheckTokenProvider();
    return token ? {...options,headers:{...options.headers,'X-Firebase-AppCheck':token}} : options;
  }
  async function request(action, { method = "GET", data = null, query = "", retried = false } = {}) {
    if (demoClient) return acceptResult(await demoClient.demoApi(action, { method, data, query }), action);
    const requestCSRF = state.session?.csrf;
    const options = { method, headers: {} };
    if (method !== "GET") options.headers["X-CSRF-Token"] = state.session?.csrf;
    if (data instanceof FormData) options.body = data;
    else if (data !== null) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(data);
    }
    const response = await fetch(requestURL(`api?action=${encodeURIComponent(action)}${query}`), requestOptions(await attestedOptions(action,options)));
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("O servidor não respondeu corretamente. Tente novamente.");
    }
    if (response.ok) return acceptResult(result, action);
    let error = responseError(response,result,"Não foi possível concluir a ação.");
    if (response.status === 401 && state.session?.user && !["login", "session", "logout"].includes(action)) {
      try {
        const renewed = !retried && !state.signingOut && (state.session.csrf !== requestCSRF || await restoreSession());
        if (renewed) return request(action, { method, data, query, retried: true });
      } catch (restoreError) {
        if (restoreError.status === 429) throw restoreError;
        error = restoreError;
      }
      clearSessionToken();
      state.session.user = null;
      onSessionExpired();
    }
    throw error;
  }
  async function fetchDownload(path, retried = false) {
    const requestCSRF = state.session?.csrf;
    const response = await fetch(requestURL(path), requestOptions(await attestedOptions('download',{})));
    if (!response.ok) {
      let result = {};
      try { result = await response.json(); } catch {}
      let error = responseError(response,result,"Não foi possível baixar o arquivo.");
      if (response.status === 401 && state.session?.user) {
        try {
          const renewed = !retried && !state.signingOut && (state.session.csrf !== requestCSRF || await restoreSession());
          if (renewed) return fetchDownload(path, true);
        } catch (restoreError) {
          if (restoreError.status === 429) throw restoreError;
          error = restoreError;
        }
        clearSessionToken();
        state.session.user = null;
        onSessionExpired();
      }
      throw error;
    }
    return response;
  }
  async function download(path) {
    if (demoClient) return demoClient.demoDownload(path);
    const response = await fetchDownload(path);
    const href = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = href;
    const disposition = response.headers.get("Content-Disposition") || "";
    let filename = disposition.match(/filename="([^"]+)"/)?.[1];
    try { filename = decodeURIComponent(disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || "") || filename; } catch {}
    link.download = (filename || "arquivo").replace(/[\\/\x00-\x1f]/g, "_");
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1e3);
  }
  async function downloadBackup(id) {
    if (demoClient) return demoClient.demoDownload('api?action=admin-backup-download');
    const ownerUid=state.session?.user?.uid;
    const unchanged=()=>{if(!ownerUid||state.signingOut||state.session?.user?.uid!==ownerUid)throw new Error('A sessão mudou. Inicie o download novamente.');};
    unchanged();
    const header=await request('admin-backup-download',{query:'&id='+encodeURIComponent(id)+'&part=manifest'});
    unchanged();
    if(header.manifest?.id!==id||!Array.isArray(header.manifest.parts)||header.manifest.parts.length<1||header.manifest.parts.length>1001)
      throw new Error('Manifesto de download inválido.');
    const pieces=[JSON.stringify({manifest:header.manifest,signature:header.signature})+'\n'];
    for(const [index,part] of header.manifest.parts.entries()){
      unchanged();
      if(part.index!==index||!Number.isSafeInteger(part.bytes)||part.bytes<1||part.bytes>10*1024*1024)throw new Error('Parte de download inválida.');
      const response=await fetchDownload('api?action=admin-backup-download&id='+encodeURIComponent(id)+'&part='+index);
      const blob=await response.blob();unchanged();
      if(blob.size!==part.bytes+1)throw new Error('O download está incompleto. Tente novamente.');
      pieces.push(blob);
    }
    const href=URL.createObjectURL(new Blob(pieces,{type:'application/octet-stream'}));
    const link=document.createElement('a');link.href=href;
    link.download=('TrackenPessoas-'+id+'.tpbackup');link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  }
  function clearSessionToken() {
    sessionToken = null;
  }
  function setRecoveryHandlers(handlers) {
    restoreSession = handlers.restoreSession;
    onSessionExpired = handlers.onSessionExpired;
  }
  function setAppCheckTokenProvider(provider) { appCheckTokenProvider = provider; }
  return { request, download, downloadBackup, clearSessionToken, setRecoveryHandlers, setAppCheckTokenProvider };
}
export {
  createAPIClient
};
