import { $ } from "../../shared/dom.mjs?v=phase2-finish-1";
import { calendarTotals } from "../calendar/presentation.mjs?v=phase2-finish-1";
function createHistory({ state, api, download, hours, recordsTable, showDataError }) {
  async function loadHistory() {
    if (!state.session?.user) return;
    const sequence = (state.historySequence || 0) + 1;
    state.historySequence = sequence;
    $("#data-error").hidden = true;
    $("#history-table").innerHTML = '<div class="empty-state">Carregando registros…</div>';
    $("#history-summary").textContent = "";
    if ($("#history-calendar-summary")) $("#history-calendar-summary").innerHTML = "";
    try {
      const result = await api("records", { query: historyQuery() });
      if (sequence !== state.historySequence) return;
      $("#history-table").innerHTML = recordsTable(result.rows, { filtered: Boolean(state.historyStatus) });
      $("#history-summary").textContent = `${result.rows.length} ${result.rows.length === 1 ? "dia exibido" : "dias exibidos"} · ${result.summary.days} com ponto · ${hours(result.summary.minutes)}`;
      if ($("#history-calendar-summary")) $("#history-calendar-summary").innerHTML = calendarTotals(result.summary, hours);
    } catch (error) {
      if (sequence === state.historySequence) {
        $("#history-table").innerHTML = '<div class="empty-state">Não foi possível carregar os registros.</div>';
        showDataError(error.message);
      }
    }
  }
  function historyQuery() {
    return `&month=${encodeURIComponent(state.month)}${state.historyStatus ? `&status=${encodeURIComponent(state.historyStatus)}` : ""}`;
  }
  function moveMonth(amount) {
    const [y, m] = state.month.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1 + amount, 1));
    state.month = date.toISOString().slice(0, 7);
    $("#history-month").value = state.month;
    loadHistory();
  }
  $("#history-month").onchange = () => {
    if (!$("#history-month").value) return;
    state.month = $("#history-month").value;
    loadHistory();
  };
  const historyStatusSelect = $("#history-status");
  if (historyStatusSelect) historyStatusSelect.onchange = () => {
    state.historyStatus = historyStatusSelect.value;
    loadHistory();
  };
  $("#prev-month").onclick = () => moveMonth(-1);
  $("#next-month").onclick = () => moveMonth(1);
  $("#export").onclick = () => download(`api?action=export${historyQuery()}`);
  return { loadHistory };
}
export {
  createHistory
};
