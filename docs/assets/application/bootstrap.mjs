import { $, busy, escapeHTML, createNotifications } from "../shared/dom.mjs?v=phase2-1";
import { hours, createDateFormatters } from "../shared/formatters.mjs?v=phase2-1";
import { createRecordsTable } from "../shared/records-table.mjs?v=phase2-1";
import { createApplicationState } from "../core/state.mjs?v=phase2-1";
import { createClock } from "../core/clock.mjs?v=phase2-1";
import { createAPIClient } from "../core/api-client.mjs?v=phase2-1";
import { createAuthentication } from "../core/auth/controller.mjs?v=phase2-1";
import { createNavigation } from "../core/navigation.mjs?v=phase2-1";
import { createAttendance } from "../features/attendance/controller.mjs?v=phase2-1";
import { createHistory } from "../features/history/controller.mjs?v=phase2-1";
import { createSpreadsheetImport } from "../features/import/controller.mjs?v=phase2-1";
import { createAdmin } from "../features/admin/controller.mjs?v=phase2-1";
import { createJourney } from "../features/journey/controller.mjs?v=phase2-1";
import { createPeople } from "../features/people/controller.mjs?v=phase2-1";
import { apiBase, demoHref } from "../connection.js?v=phase2-1";
async function startApplication() {
  const isDemo = document.body.dataset.mode === "demo";
  const demoClient = isDemo ? await import("../demo/api.mjs?v=phase2-1") : null;
  const state = createApplicationState();
  const clock = createClock(state);
  const { toast, showDataError } = createNotifications();
  const { formatDate, monthLabel } = createDateFormatters(() => state.timezone);
  const recordsTable = createRecordsTable({ state, formatDate, hours });
  const client = createAPIClient({ state, baseURL: apiBase, demoClient, syncTime: clock.syncTime });
  const api = client.request;
  const bootContent = $("#boot").innerHTML;
  const download = async (path) => {
    try {
      await client.download(path);
    } catch (error) {
      toast(error.message, true);
    }
  };
  const navigation = createNavigation({ state, onView: loadView });
  const shared = { state, api, busy, toast, hours, ...clock, formatDate };
  const attendance = createAttendance({ ...shared, monthLabel, recordsTable, showDataError });
  const history = createHistory({ ...shared, download, recordsTable, showDataError });
  const spreadsheet = createSpreadsheetImport({ ...shared, download, recordsTable, loadHome: attendance.loadHome, switchView: navigation.switchView });
  const admin = createAdmin({ ...shared, onCorrection: attendance.loadHome });
  const journey = createJourney({ ...shared, getUser: () => state.session?.user });
  const people = createPeople({ ...shared, download, switchView: navigation.switchView });
  const authentication = createAuthentication({
    state,
    api,
    toast,
    isDemo,
    demoHref,
    showApp,
    showLogin,
    clearApiToken: client.clearSessionToken,
    resetFeatures
  });
  client.setRecoveryHandlers({ restoreSession: authentication.restoreSession, onSessionExpired: showLogin });
  function resetFeatures() {
    people.reset();
    journey.reset();
    admin.reset();
    spreadsheet.invalidatePreview();
  }
  function showLogin() {
    navigation.setMenu(false);
    resetFeatures();
    $("#app").hidden = true;
    $("#login").hidden = false;
    $("#boot").hidden = true;
    const ready = Boolean(state.session?.firebaseReady);
    $("#demo-access").hidden = !state.session?.demoAllowed;
    $("#setup-note").hidden = ready;
    $("#setup-note").textContent = state.session?.demoAllowed ? "O login da empresa está sendo configurado. Você pode abrir a demonstração com dados de teste." : "O login da empresa ainda não foi configurado. Entre em contato com o responsável pelo site.";
    for (const id of ["email", "password", "login-submit", "reset-password", "google-login", "register-toggle"]) $(`#${id}`).disabled = !ready;
    $("#confirm-password").disabled = !ready || state.authMode !== "register";
  }
  async function loadView(view) {
    if (["ficha", "pessoas", "gestao"].includes(view)) await people.open(view);
    if (view === "registro" && state.session?.user) await attendance.loadHome();
    if (view === "espelho") await history.loadHistory();
    if (view === "jornada") await journey.open();
    if (view === "admin") {
      await admin.open();
      await journey.openAdmin();
    }
  }
  async function showApp() {
    $("#login").hidden = true;
    $("#app").hidden = false;
    $("#login-error").hidden = true;
    const user = state.session.user;
    const initial = user.name.split(" ")[0].slice(0, 1).toUpperCase();
    $("#user-name").textContent = user.name;
    $("#avatar").textContent = initial;
    $("#small-avatar").textContent = initial;
    $("#user-role").textContent = user.demo ? "Dados de exemplo" : user.role === "admin" ? "Administrador" : "Funcionário";
    $("#admin-nav").hidden = user.role !== "admin";
    $("#demo-banner").hidden = !user.demo;
    $("#mode-badge").hidden = !user.demo;
    await people.initialize();
    $("#footer-zone").textContent = state.timezone;
    $(".timezone-pill").textContent = state.timezone === "America/Sao_Paulo" ? "Horário de Brasília" : state.timezone;
    state.month = clock.currentMonth();
    $("#history-month").value = state.month;
    $("#import-year").value = clock.currentParts().year;
    const requested = location.hash.replace("#", "");
    const allowed = ["registro", "espelho", "importar", "jornada", "ficha", "visao", ...(state.peopleContext?.canManagePeople ? ["pessoas", "gestao"] : []), ...user.role === "admin" ? ["admin"] : []];
    navigation.switchView(allowed.includes(requested) ? requested : "registro", false);
    attendance.updateClock();
    await attendance.loadHome();
    await journey.open();
    if (state.view !== "registro" && state.view !== "jornada") await loadView(state.view);
  }
  function configureDemoCopy() {
    const selector = $("#demo-actor");
    selector.innerHTML = demoClient.demoActors.map(actor => `<option value="${escapeHTML(actor.uid)}">${escapeHTML(actor.label)}</option>`).join("");
    selector.onchange = async () => {
      try {
        resetFeatures();
        await api("demo-persona", { method: "POST", data: { uid: selector.value } });
        state.session = await api("session");
        await showApp();
      } catch (error) { toast(error.message, true); }
    };
    for (const button of [$("#logout"), $("#mobile-logout")]) {
      button.setAttribute("aria-label", "Voltar ao login");
      button.title = "Voltar ao login";
    }
    $(".sidebar-note strong").textContent = "Modo de demonstração.";
    $(".sidebar-note p").textContent = "Explore com dados de exemplo. Ao atualizar, as marcações de teste são descartadas.";
    $("#punch-confirm > p").textContent = "Esta é uma marcação de teste e será descartada ao atualizar a página.";
  }
  async function bootstrap() {
    $("#boot").innerHTML = bootContent;
    try {
      if (isDemo) {
        await api("demo", { method: "POST" });
        configureDemoCopy();
      }
      state.session = await api("session");
      state.timezone = state.session.timezone;
      clock.syncTime(state.session.serverTime);
      if (!isDemo && state.session.firebaseReady) {
        const [auth] = await authentication.firebaseAuth();
        if (state.session.user && auth.currentUser?.uid !== state.session.user.uid) {
          await api("logout", { method: "POST", data: {} });
          client.clearSessionToken();
          state.session = await api("session");
        }
        if (!state.session.user) await authentication.restoreSession();
      }
      $("#boot").hidden = true;
      if (state.session.user) await showApp();
      else showLogin();
    } catch (error) {
      if ([401, 403].includes(error.status) || error.code?.startsWith("auth/")) {
        showLogin();
        $("#login-error").textContent = authentication.authError(error);
        $("#login-error").hidden = false;
      } else {
        $("#app").hidden = true;
        $("#login").hidden = true;
        $("#boot").hidden = false;
        $("#boot").innerHTML = `<p>${escapeHTML(error.message)}</p><button class="button secondary" id="retry-boot">Tentar novamente</button>`;
        $("#retry-boot").onclick = bootstrap;
      }
    }
  }
  $("#retry-data").onclick = () => state.view === "espelho" ? history.loadHistory() : attendance.loadHome();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !state.session?.user) return;
    attendance.loadHome();
    if (state.view === "espelho") history.loadHistory();
  });
  setInterval(attendance.updateClock, 1e3);
  await bootstrap();
}
export {
  startApplication
};
