import { escapeHTML as escape } from "../../shared/dom.mjs?v=phase2-finish-1";
import { formatInstant } from "../../shared/formatters.mjs?v=phase2-finish-1";
const labels = { recorded: "Marcações", weekend: "Fim de semana", medical: "Atestado", not_applicable: "Não se aplica" };
function describeState(state) {
  if (!state) return "Sem registro";
  let times = state.times;
  if (typeof times === "string") {
    try {
      times = JSON.parse(times);
    } catch {
      times = [];
    }
  }
  return Array.isArray(times) && times.length ? times.join(" | ") : labels[state.status] || "Sem marcações";
}
function renderEvent(event) {
  const payload = event.payload || {};
  if (event.kind === "original_event") {
    const type = { entry: "Entrada", exit: "Saída", return: "Retorno" }[payload.markType] || "Marcação";
    return `<article class="provenance-event"><strong>${escape(type)} · ${escape(payload.time || "Horário não informado")}</strong><dl class="overtime-details"><dt>Registrada em</dt><dd>${escape(formatInstant(payload.occurredAt || event.createdAt))}</dd><dt>Origem</dt><dd>${escape(payload.collector === "web" ? "Aplicativo web" : payload.collector || "Não informada")}</dd></dl></article>`;
  }
  if (event.kind === "historical_snapshot") {
    return `<article class="provenance-event"><strong>${payload.source === "import_baseline" ? "Histórico importado de planilha" : "Versão anterior preservada"}</strong><dl class="overtime-details"><dt>Marcações ou ocorrência</dt><dd>${escape(describeState(payload.state))}</dd><dt>Preservada em</dt><dd>${escape(formatInstant(payload.observedAt || event.createdAt))}</dd>${payload.filename ? `<dt>Arquivo de origem</dt><dd>${escape(payload.filename)}</dd>` : ""}</dl></article>`;
  }
  return `<article class="provenance-event"><strong>Ajuste administrativo · ${escape(formatInstant(payload.changedAt || event.createdAt))}</strong><div class="admin-comparison"><div><span>Antes</span><strong>${escape(describeState(payload.before))}</strong></div><div><span>Depois</span><strong>${escape(describeState(payload.after))}</strong></div></div><p class="admin-reason">${escape(payload.reason || "Justificativa não informada.")}</p><p class="field-hint">O responsável pela alteração consta no histórico administrativo.</p></article>`;
}
function renderProvenance(events = []) {
  const groups = [
    { kind: "original_event", title: "Marcações registradas", empty: "Nenhuma marcação registrada pelo aplicativo neste dia." },
    { kind: "historical_snapshot", title: "Histórico preservado", empty: "Nenhuma versão anterior ou importação neste dia." },
    { kind: "treatment", title: "Ajustes administrativos", empty: "Nenhum ajuste neste dia." }
  ];
  return groups.map((group) => {
    const rows = events.filter((event) => event.kind === group.kind);
    return `<section class="history-card provenance-section" data-provenance-kind="${group.kind}"><div class="card-heading"><h3>${group.title}</h3><span class="field-hint">${rows.length} ${rows.length === 1 ? "evento" : "eventos"}</span></div>${rows.length ? rows.map(renderEvent).join("") : `<p class="empty-state">${group.empty}</p>`}</section>`;
  }).join("");
}
function createProvenance({ api, formatDate }) {
  const view = document.querySelector("#view-admin");
  const dialog = document.createElement("dialog");
  dialog.id = "admin-provenance-dialog";
  dialog.className = "confirm-dialog admin-dialog provenance-dialog";
  dialog.setAttribute("aria-labelledby", "admin-provenance-title");
  dialog.innerHTML = `<h2 id="admin-provenance-title">Histórico do registro</h2><p id="admin-provenance-person"></p><div id="admin-provenance-error" class="data-error" role="alert" hidden></div><div id="admin-provenance-content"></div><div class="dialog-actions"><button id="admin-provenance-more" type="button" class="button secondary" hidden>Carregar mais eventos</button><button id="admin-provenance-close" type="button" class="button primary">Fechar</button></div>`;
  view.append(dialog);
  const element = (id) => document.getElementById(id);
  let epoch = 0;
  let selected = null;
  let events = [];
  let nextOffset = null;
  async function load(append = false) {
    if (!selected || append && nextOffset === null) return;
    const generation = epoch;
    const { uid, date } = selected;
    element("admin-provenance-error").hidden = true;
    element("admin-provenance-more").disabled = true;
    if (!append) {
      element("admin-provenance-more").hidden = true;
      element("admin-provenance-content").innerHTML = '<p class="empty-state">Consultando o histórico…</p>';
    }
    try {
      const result = await api("admin-record-provenance", { query: `&uid=${encodeURIComponent(uid)}&date=${encodeURIComponent(date)}&offset=${append ? nextOffset : 0}` });
      if (generation !== epoch) return;
      const incoming = Array.isArray(result.events) ? result.events : [];
      events = [...new Map((append ? [...events, ...incoming] : incoming).map((event) => [event.kind + ":" + event.id, event])).values()];
      nextOffset = Number.isSafeInteger(result.nextOffset) && result.nextOffset >= 0 ? result.nextOffset : null;
      element("admin-provenance-content").innerHTML = renderProvenance(events);
      element("admin-provenance-more").hidden = nextOffset === null;
    } catch (error) {
      if (generation !== epoch) return;
      element("admin-provenance-error").textContent = error.message;
      element("admin-provenance-error").hidden = false;
      if (!append) element("admin-provenance-content").innerHTML = "";
    } finally {
      if (generation === epoch) element("admin-provenance-more").disabled = false;
    }
  }
  element("admin-provenance-more").onclick = () => load(true);
  element("admin-provenance-close").onclick = () => dialog.close();
  return {
    async open(person, date) {
      epoch++;
      selected = { uid: person.uid, date };
      events = [];
      nextOffset = null;
      element("admin-provenance-title").textContent = "Histórico do registro · " + formatDate(date);
      element("admin-provenance-person").textContent = person.name;
      dialog.showModal();
      await load();
    },
    reset() {
      epoch++;
      selected = null;
      events = [];
      nextOffset = null;
      dialog.close();
      element("admin-provenance-content").innerHTML = "";
      element("admin-provenance-person").textContent = "";
      element("admin-provenance-error").hidden = true;
      element("admin-provenance-more").hidden = true;
    }
  };
}
export {
  createProvenance,
  renderProvenance
};
