function createAPIClient({ state, baseURL, demoClient, syncTime }) {
  const external = Boolean(baseURL && new URL(baseURL).origin !== location.origin);
  let sessionToken = null;
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
    const response = await fetch(requestURL(`api?action=${encodeURIComponent(action)}${query}`), requestOptions(options));
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("O servidor não respondeu corretamente. Tente novamente.");
    }
    if (response.ok) return acceptResult(result, action);
    let error = Object.assign(new Error(result.error || "Não foi possível concluir a ação."), { status: response.status, code: result.code });
    if (response.status === 401 && state.session?.user && !["login", "session", "logout"].includes(action)) {
      try {
        const renewed = !retried && !state.signingOut && (state.session.csrf !== requestCSRF || await restoreSession());
        if (renewed) return request(action, { method, data, query, retried: true });
      } catch (restoreError) {
        error = restoreError;
      }
      clearSessionToken();
      state.session.user = null;
      onSessionExpired();
    }
    throw error;
  }
  async function download(path) {
    if (demoClient) return demoClient.demoDownload(path);
    const response = await fetch(requestURL(path), requestOptions());
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Não foi possível baixar o arquivo.");
    }
    const href = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = href;
    link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "ponto.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1e3);
  }
  function clearSessionToken() {
    sessionToken = null;
  }
  function setRecoveryHandlers(handlers) {
    restoreSession = handlers.restoreSession;
    onSessionExpired = handlers.onSessionExpired;
  }
  return { request, download, clearSessionToken, setRecoveryHandlers };
}
export {
  createAPIClient
};
