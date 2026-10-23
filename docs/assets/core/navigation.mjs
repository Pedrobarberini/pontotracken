import { $, $$ } from "../shared/dom.mjs?v=admin-roles-1";
function createNavigation({ state, onView }) {
  const mobileMenu = matchMedia("(max-width:860px)");
  function setMenu(open, restoreFocus = false) {
    const visible = Boolean(open && mobileMenu.matches);
    $("#sidebar").classList.toggle("open", visible);
    $("#sidebar").inert = mobileMenu.matches && !visible;
    $("#sidebar-backdrop").hidden = !visible;
    $("#sidebar-backdrop").classList.toggle("open", visible);
    $("#menu-toggle").setAttribute("aria-expanded", String(visible));
    $("#menu-toggle").setAttribute("aria-label", visible ? "Fechar menu" : "Abrir menu");
    document.body.style.overflow = visible ? "hidden" : "";
    if (restoreFocus) $("#menu-toggle").focus();
  }
  $("#menu-toggle").onclick = () => {
    const open = $("#menu-toggle").getAttribute("aria-expanded") !== "true";
    setMenu(open);
    if (open) $("#sidebar .nav-button.active").focus();
  };
  $("#sidebar-backdrop").onclick = () => setMenu(false, true);
  mobileMenu.addEventListener("change", () => setMenu(false));
  document.addEventListener("keydown", (event) => {
    if ($("#menu-toggle").getAttribute("aria-expanded") !== "true") return;
    if (event.key === "Escape") {
      event.preventDefault();
      setMenu(false, true);
    }
    if (event.key === "Tab") {
      const focusable = [...$("#sidebar").querySelectorAll("a[href],button:not([disabled])")].filter((el) => el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  setMenu(false);
  function switchView(view, load = true) {
    if (!["registro", "espelho", "importar", "jornada", "admin", "visao", "ficha", "pessoas", "gestao", "ausencias", "ciclo", "desenvolvimento", "indicadores"].includes(view)) view = "registro";
    if (view === "admin" && state.session?.user?.role !== "admin") view = "registro";
    if (["pessoas", "gestao", "indicadores"].includes(view) && !state.peopleContext?.canManagePeople) view = "ficha";
    setMenu(false, $("#menu-toggle").getAttribute("aria-expanded") === "true");
    state.view = view;
    const names = { registro: "Meu ponto", espelho: "Espelho de ponto", importar: "Importar planilha", jornada: "Status e horas extras", admin: "Administração", visao: "Visão do produto", ficha: "Ficha do colaborador", pessoas: "Colaboradores", gestao: "Início da gestão", ausencias: "Férias e ausências", ciclo: "Admissão e desligamento", desenvolvimento: "Desenvolvimento", indicadores: "Indicadores" };
    for (const el of $$(".view")) el.hidden = el.id !== `view-${view}`;
    for (const btn of $$("[data-view]")) {
      const active = btn.dataset.view === view;
      btn.classList.toggle("active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    }
    $("#breadcrumb-view").textContent = names[view];
    $("#breadcrumb-group").textContent = ["ficha", "pessoas", "gestao", "ausencias", "ciclo", "desenvolvimento", "indicadores"].includes(view) ? "Gestão de pessoas" : ["admin", "visao"].includes(view) ? "Empresa" : "Minha jornada";
    history.replaceState(null, "", `#${view}`);
    if (load) window.scrollTo({ top: 0, behavior: "instant" });
    if (load) onView(view);
  }
  $$("[data-view]").forEach((btn) => btn.onclick = () => switchView(btn.dataset.view));
  $("#sidebar .brand").onclick = (event) => {
    event.preventDefault();
    switchView("registro");
  };
  $$("[data-open-import]").forEach((btn) => btn.onclick = () => switchView("importar"));
  $$("[data-open-history]").forEach((btn) => btn.onclick = () => switchView("espelho"));
  return { switchView, setMenu };
}
export {
  createNavigation
};
