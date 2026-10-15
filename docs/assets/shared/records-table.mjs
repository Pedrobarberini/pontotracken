import { escapeHTML as esc, icon } from "./dom.mjs?v=phases34-1";
import { dateObject } from "./formatters.mjs?v=phases34-1";
import { recordStatus, sourceLabel } from "../features/calendar/presentation.mjs?v=phases34-1";
function createRecordsTable({ state, formatDate, hours }) {
  function recordsTable(rows, { preview = false, filtered = false } = {}) {
    if (!rows.length) return `<div class="empty-state">${icon("calendar")}<strong>${filtered ? "Nenhum registro nesta situação." : "Nenhum registro por aqui."}</strong><span>${filtered ? "Escolha outra situação ou outro mês para consultar." : preview ? "Não há células válidas para importar." : "Registre seu ponto ou importe seu histórico do Excel."}</span></div>`;
    const header = preview ? ["Data", "Marcações / ocorrência", "Horas", "Importação"] : ["Data", "Marcações", "Horas", "Situação", "Origem"];
    const body = rows.map((row) => {
      const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: state.timezone }).format(dateObject(row.date)).replace(".", "");
      const times = row.times.length ? row.times.map((t) => esc(t.slice(0, 5))).join('<span class="time-separator">|</span>') : preview ? esc(row.raw) : "—";
      const status = recordStatus({ ...row, incomplete: row.times.length % 2 === 1 });
      const source = sourceLabel(row);
      return `<tr><td>${esc(formatDate(row.date))}<span class="day-week">${esc(weekday)}</span></td><td class="times">${times}${preview ? "" : `<span class="mobile-status">${status}</span>`}</td><td class="times">${row.times.length ? hours(row.minutes) : "—"}</td>${preview ? `<td><span class="status ${row.exists ? "existing" : ""}">${row.exists ? "Já existe · preservar" : "Novo registro"}</span></td>` : `<td>${status}</td><td><span class="source-label">${source}</span></td>`}</tr>`;
    }).join("");
    return `<div class="table-scroll"><table class="records-table ${preview ? "preview-table" : "history-table"}"><thead><tr>${header.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  return recordsTable;
}
export {
  createRecordsTable
};
