function createApplicationState() {
  return {
    session: null,
    clockOffset: 0,
    timezone: "America/Sao_Paulo",
    view: "registro",
    month: "",
    historyStatus: "",
    today: null,
    todayContext: {},
    preview: null,
    file: null,
    auth: null,
    authModule: null,
    authPromise: null,
    restorePromise: null,
    signingOut: false,
    authMode: "login",
    authenticating: false,
    punchRequest: null
  };
}
export {
  createApplicationState
};
