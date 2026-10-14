import { createFirebaseIdentity } from "./firebase.mjs?v=perf-1";
import { $, busy } from "../../shared/dom.mjs?v=perf-1";
import { exchangeFirebaseLogin, restoreFirebaseLogin } from "./persistent-login.mjs?v=perf-1";
function createAuthentication({ state, api, toast, isDemo, demoHref, showApp, showLogin, clearApiToken, resetFeatures }) {
  const { firebaseAuth } = createFirebaseIdentity(state);
  function loginExchange() {
    return { exchange: (idToken) => api("login", { method: "POST", data: { idToken } }), signOut: () => state.authModule.signOut(state.auth) };
  }
  async function restoreSession() {
    if (state.signingOut) return false;
    if (!state.restorePromise) state.restorePromise = (async () => {
      const [auth] = await firebaseAuth();
      if (!await restoreFirebaseLogin(auth, loginExchange())) return false;
      state.session = await api("session");
      return Boolean(state.session.user);
    })().finally(() => {
      state.restorePromise = null;
    });
    return state.restorePromise;
  }
  function authError(error) {
    return { "auth/invalid-credential": "E-mail ou senha incorretos.", "auth/user-disabled": "Sua conta foi desativada. Fale com a empresa.", "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.", "auth/network-request-failed": "Confira sua conexão e tente novamente.", "auth/invalid-email": "Digite um e-mail válido.", "auth/unauthorized-domain": "O domínio do site precisa ser autorizado no Firebase.", "auth/email-already-in-use": "Este e-mail já tem uma conta. Entre com sua senha ou use o Google.", "auth/weak-password": "Use uma senha mais forte, com pelo menos 6 caracteres e de acordo com as regras da empresa.", "auth/password-does-not-meet-requirements": "A senha não atende às regras de segurança da empresa.", "auth/popup-blocked": "Permita a abertura de janelas para este site e tente entrar com Google novamente.", "auth/popup-closed-by-user": "O login com Google foi cancelado. Você pode tentar novamente.", "auth/cancelled-popup-request": "Já existe uma janela de login aberta. Conclua o acesso nela.", "auth/operation-not-allowed": "Este método de login precisa ser ativado no Firebase.", "auth/account-exists-with-different-credential": "Este e-mail já usa outro método de acesso. Entre com o método que você usou no cadastro." }[error.code] || error.message || "Não foi possível concluir o acesso.";
  }
  function clearAuthMessages() {
    $("#login-error").hidden = true;
    $("#auth-message").hidden = true;
  }
  function setAuthMode(mode, clearMessages = true) {
    state.authMode = mode;
    const register = mode === "register";
    if (clearMessages) clearAuthMessages();
    $("#auth-eyebrow").textContent = register ? "PRIMEIRO ACESSO" : "BEM-VINDO";
    $("#auth-title").textContent = register ? "Crie sua conta" : "Entre na sua conta";
    $("#auth-description").textContent = register ? "Cadastre seu e-mail para solicitar acesso ao ponto." : "Use seu e-mail ou entre com sua conta Google.";
    $("#confirm-password-field").hidden = !register;
    $("#confirm-password").disabled = !register || !state.session.firebaseReady;
    $("#confirm-password").required = register;
    $("#register-note").hidden = !register;
    $("#reset-password").hidden = register;
    $("#password").autocomplete = register ? "new-password" : "current-password";
    if (register) $("#password").minLength = 6;
    else $("#password").removeAttribute("minlength");
    $("#password").value = "";
    $("#password").type = "password";
    $("#confirm-password").value = "";
    $("#confirm-password").setCustomValidity("");
    $("#toggle-password").setAttribute("aria-label", "Mostrar senha");
    $("#login-submit").textContent = register ? "Criar conta" : "Entrar";
    $("#auth-switch-label").textContent = register ? "Já tem uma conta?" : "Primeiro acesso?";
    $("#register-toggle").textContent = register ? "Entrar na minha conta" : "Criar conta";
  }
  async function authenticationWork(button, work, label) {
    if (state.authenticating) return;
    state.authenticating = true;
    clearAuthMessages();
    const controls = ["login-submit", "google-login", "register-toggle", "reset-password"];
    controls.forEach((id) => $(`#${id}`).disabled = true);
    try {
      return await busy(button, work, label);
    } finally {
      state.authenticating = false;
      controls.forEach((id) => $(`#${id}`).disabled = !state.session.firebaseReady);
      $("#login-submit").textContent = state.authMode === "register" ? "Criar conta" : "Entrar";
    }
  }
  async function finishLogin(credential, created = false) {
    try {
      await exchangeFirebaseLogin(credential.user, loginExchange());
    } catch (error) {
      if (error.code !== "ACCOUNT_PENDING_APPROVAL") throw error;
      $("#email").value = credential.user.email || $("#email").value;
      setAuthMode("login", false);
      $("#auth-message").textContent = created ? "Conta criada! Aguarde a autorização da empresa para registrar seu ponto." : "Sua conta foi identificada. Aguarde a autorização da empresa para registrar seu ponto.";
      $("#auth-message").hidden = false;
      return;
    }
    $("#password").value = "";
    $("#confirm-password").value = "";
    state.session = await api("session");
    await showApp();
  }
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const register = state.authMode === "register";
    if (register && $("#password").value !== $("#confirm-password").value) {
      $("#confirm-password").setCustomValidity("As senhas precisam ser iguais.");
      $("#confirm-password").reportValidity();
      return;
    }
    const email = $("#email").value.trim(), password = $("#password").value;
    try {
      await authenticationWork($("#login-submit"), async () => {
        const [auth, mod] = await firebaseAuth();
        const credential = await (register ? mod.createUserWithEmailAndPassword(auth, email, password) : mod.signInWithEmailAndPassword(auth, email, password));
        await finishLogin(credential, register);
      }, register ? "Criando conta…" : "Entrando…");
    } catch (error) {
      $("#login-error").textContent = authError(error);
      $("#login-error").hidden = false;
    }
  });
  $("#register-toggle").onclick = () => {
    if (state.authenticating) return;
    setAuthMode(state.authMode === "register" ? "login" : "register");
    $("#email").focus();
  };
  $("#confirm-password").addEventListener("input", () => $("#confirm-password").setCustomValidity(""));
  $("#password").addEventListener("input", () => $("#confirm-password").setCustomValidity(""));
  $("#google-login").onclick = async () => {
    try {
      await authenticationWork($("#google-login"), async () => {
        const [auth, mod] = await firebaseAuth(), provider = new mod.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await finishLogin(await mod.signInWithPopup(auth, provider));
      }, "Abrindo Google…");
    } catch (error) {
      $("#login-error").textContent = authError(error);
      $("#login-error").hidden = false;
    }
  };
  $("#demo-login").onclick = () => {
    location.href = demoHref;
  };
  $("#toggle-password").onclick = () => {
    const input = $("#password");
    input.type = input.type === "password" ? "text" : "password";
    $("#toggle-password").setAttribute("aria-label", input.type === "password" ? "Mostrar senha" : "Ocultar senha");
  };
  $("#reset-password").onclick = async () => {
    if (!$("#email").validity.valid || !$("#email").value) {
      $("#email").focus();
      toast("Informe seu e-mail para recuperar a senha.", true);
      return;
    }
    try {
      await authenticationWork($("#reset-password"), async () => {
        const [auth, mod] = await firebaseAuth();
        await mod.sendPasswordResetEmail(auth, $("#email").value.trim());
        toast("Se o e-mail estiver cadastrado, você receberá as instruções.");
      }, "Enviando…");
    } catch (error) {
      toast(authError(error), true);
    }
  };
  async function logout() {
    if (isDemo) {
      location.href = new URL("./", document.baseURI).href;
      return;
    }
    if (state.signingOut) return;
    state.signingOut = true;
    try {
      await state.restorePromise?.catch(() => {
      });
      try {
        await api("logout", { method: "POST", data: {} });
      } catch (error) {
        if (error.status !== 401) toast(error.message, true);
      }
      if (state.auth) await state.authModule.signOut(state.auth);
      clearApiToken();
      resetFeatures();
      state.preview = null;
      state.punchRequest = null;
      state.session.user = null;
      $("#preview-panel").hidden = true;
      state.session = await api("session").catch(() => state.session);
      setAuthMode("login");
      showLogin();
    } catch (error) {
      toast(authError(error), true);
    } finally {
      state.signingOut = false;
    }
  }
  $("#logout").onclick = logout;
  $("#mobile-logout").onclick = logout;
  return { firebaseAuth, restoreSession, authError, setAuthMode };
}
export {
  createAuthentication
};
