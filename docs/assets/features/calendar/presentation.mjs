import { escapeHTML as esc } from "../../shared/dom.mjs?v=perf-1";
function calendarLabel(row) {
  if (!row) return "";
  const kind = row.calendarKind ?? (row.status === "weekend" ? "weekend" : "regular");
  return { holiday: "Feriado", weekend: "Fim de semana", off_schedule: "Fora da escala" }[kind] || "";
}
function calendarBadge(row) {
  const label = calendarLabel(row);
  if (!label) return "";
  const worked = Boolean(row.hasPunches ?? row.times?.length), state = worked ? row.incomplete ? "Em aberto" : "Trabalhado" : "Sem marcação";
  const kind = ["holiday", "weekend", "off_schedule"].includes(row.calendarKind) ? row.calendarKind : "weekend";
  const additional = row.calendarKind === "holiday" && row.isWeekend && row.isScheduledDay !== true ? `<span class="status calendar-badge ${row.outsideSchedule === true ? "off_schedule" : "weekend"}">${row.outsideSchedule === true ? "FDS fora da escala" : "Fim de semana"}</span>` : row.calendarKind === "holiday" && row.outsideSchedule === true ? '<span class="status calendar-badge off_schedule">Fora da escala</span>' : "";
  return `<span class="status calendar-badge ${kind}"${row.holidayName ? ` title="${esc(row.holidayName)}"` : ""}>${label} · ${state}</span>${additional}${row.holidayName ? `<span class="calendar-name">${esc(row.holidayName)}</span>` : ""}`;
}
function recordStatus(row) {
  const badge = calendarBadge(row), hasPunches = Boolean(row.hasPunches ?? row.times?.length), occurrence = !row.virtual && !hasPunches && !["recorded", "weekend", "holiday", "off_schedule"].includes(row.status);
  const label = hasPunches ? row.incomplete ? "Em aberto" : "Registrado" : occurrence ? row.label : !badge ? row.label || "Sem marcações" : "";
  const primary = label ? `<span class="status ${row.incomplete ? "pending" : esc(row.status)}">${esc(label)}</span>` : "";
  return `<span class="calendar-badges">${primary}${badge}</span>`;
}
function sourceLabel(row) {
  return { calendar: "Calendário", import: "Planilha", live: "Site", demo: "Exemplo", admin: "Ajuste ADMIN" }[row?.source] || "Planilha";
}
function calendarTotals(summary = {}, hours) {
  return `${[["Em feriados", summary.holidayWorkedMinutes], ["Fora da escala", summary.offScheduleWorkedMinutes], ["FDS fora da escala", summary.weekendOffScheduleWorkedMinutes]].map(([label, value]) => `<div><span>${label}</span><strong>${hours(Number(value) || 0)}</strong></div>`).join("")}<p class="field-hint">Feriado e dia fora da escala podem coincidir. As horas do total geral são contadas uma única vez. Estes indicadores não calculam adicionais nem valores de pagamento.</p>`;
}
function todayCalendarNote(context = {}) {
  if (context.calendarKind === "holiday") return `Hoje é feriado nacional${context.holidayName ? ": " + context.holidayName : "."}${context.holidayName ? "." : ""} Se trabalhar, registre o ponto normalmente; as horas ficam destacadas no espelho.`;
  if (context.calendarKind === "off_schedule") return "Hoje está fora da sua escala vigente. Se trabalhar, registre o ponto normalmente; as horas ficam destacadas no espelho.";
  if (context.calendarKind === "weekend") return context.outsideSchedule === true ? "Hoje é fim de semana e está fora da sua escala vigente. Se trabalhar, registre o ponto normalmente; as horas ficam destacadas no espelho." : "Hoje é fim de semana. Se trabalhar, registre o ponto normalmente. A jornada ainda não foi configurada para determinar se o dia está fora da escala.";
  return "";
}
export {
  calendarBadge,
  calendarLabel,
  calendarTotals,
  recordStatus,
  sourceLabel,
  todayCalendarNote
};
