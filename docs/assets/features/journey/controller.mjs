import { createOvertimePresentation } from "./presentation.mjs?v=perf-1";
import { mountJourneyViews } from "./views.mjs?v=perf-1";
import { calendarBadge } from "../calendar/presentation.mjs?v=perf-1";
import { escapeHTML as esc } from "../../shared/dom.mjs?v=perf-1";
const activityNames = { available: "Disponível", lunch: "Almoço", break: "Pausa rápida", meeting: "Reunião", external: "Externo", offline: "Offline" };
const statusNames = { running: "Em andamento", pending: "Aguardando análise", approved: "Aprovada", rejected: "Recusada" };
const when = (value) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
function createJourney({ api, busy, toast, hours, currentMonth, currentParts, getUser }) {
  const host = document.querySelector("#journey-tools"), teamHost = document.querySelector("#team-panel");
  if (!host || !teamHost) return { start: async () => {
  }, open: async () => {
  }, openAdmin: async () => {
  }, reset() {
  } };
  const $ = (id) => document.getElementById(id), today = () => {
    const p = currentParts();
    return `${p.year}-${p.month}-${p.day}`;
  };
  let active = null, ownRows = [], approvers = [], people = [], requests = [], teamOffset = 0, teamNext = null, reviewOffset = 0, reviewNext = null, epoch = 0, mineSequence = 0, teamSequence = 0, reviewSequence = 0, heartbeat = null, refresh = null, selected = null, decision = null, closingRecord = null, assigningRecord = null, serverOffset = 0, enabled = false, pendingHeartbeat = false;
  const mutationKeys = /* @__PURE__ */ new Map();
  mountJourneyViews({ host, teamHost, activityNames, statusNames });
  function fail(error, id = "journey-error") {
    if (!enabled) return;
    $(id).textContent = error.message;
    $(id).hidden = false;
  }
  function scheduleText(s) {
    return s ? `${s.start_time} a ${s.end_time} · ${hours(s.expected_minutes)} de jornada · ${s.break_minutes} min de intervalo` : "Jornada ainda não configurada.";
  }
  function tick() {
    if (active && enabled) {
      const elapsed = Math.max(0, Math.floor((Date.now() + serverOffset - Date.parse(active.start_at)) / 1e3));
      $("overtime-clock").textContent = [Math.floor(elapsed / 3600), Math.floor(elapsed % 3600 / 60), elapsed % 60].map((n) => String(n).padStart(2, "0")).join(":");
    }
  }
  const { occurrence, details, approverLabel } = createOvertimePresentation({ hours, getUser, statusNames });
  function fillApprovers(select, selected2 = "") {
    select.innerHTML = '<option value="">Escolha o responsável</option>' + approvers.map((person) => `<option value="${esc(person.uid)}">${esc(person.name || person.email || person.uid)}${person.email ? " · " + esc(person.email) : ""}</option>`).join("");
    select.value = approvers.some((person) => person.uid === selected2) ? selected2 : "";
    select.disabled = approvers.length === 0;
  }
  async function mutate(action, data) {
    const key = action + ":" + (data.id || "new"), signature = JSON.stringify(data);
    let pending = mutationKeys.get(key);
    if (!pending || pending.signature !== signature) {
      pending = { signature, id: crypto.randomUUID() };
      mutationKeys.set(key, pending);
    }
    const result = await api(action, { method: "POST", data: { ...data, requestId: pending.id } });
    mutationKeys.delete(key);
    return result;
  }
  async function mine() {
    const generation = epoch, sequence = ++mineSequence;
    try {
      const result = await api("journey", { query: "&month=" + $("overtime-month").value });
      if (generation !== epoch || sequence !== mineSequence || !enabled) return;
      serverOffset = Date.parse(result.serverTime) - Date.now();
      ownRows = result.rows;
      approvers = (result.approvers || []).filter((person) => person.uid !== getUser()?.uid);
      fillApprovers($("overtime-approver"), $("overtime-approver").value);
      active = ownRows.find((row) => row.status === "running") || null;
      $("activity-select").value = result.presence?.activity || "available";
      $("my-schedule").textContent = scheduleText(result.schedule);
      $("my-overtime-list").innerHTML = ownRows.length ? ownRows.map((row) => occurrence(row)).join("") : '<div class="empty-state">Nenhuma ocorrência neste mês.</div>';
      if (result.truncated) $("my-overtime-list").insertAdjacentHTML("beforeend", '<p class="field-hint">Exibindo as 100 ocorrências mais recentes.</p>');
      $("overtime-running").hidden = !active;
      $("overtime-running-info").textContent = active ? `Iniciado em ${when(active.start_at)} · Solicitado por ${active.requested_by} · Aprovação: ${approverLabel(active)}` : "";
      mode();
      tick();
    } catch (error) {
      if (generation === epoch && sequence === mineSequence) fail(error);
    }
  }
  async function beat(activity) {
    if (!enabled || pendingHeartbeat) return;
    pendingHeartbeat = true;
    const generation = epoch;
    try {
      const result = await api("presence", { method: "POST", data: activity ? { activity } : {} });
      if (generation !== epoch || !enabled) return;
      $("activity-feedback").textContent = `Status informado: ${activityNames[result.activity]}.`;
      if (activity) $("activity-select").value = result.activity;
    } catch (error) {
      if (activity) fail(error);
    } finally {
      if (generation === epoch) pendingHeartbeat = false;
    }
  }
  function mode() {
    const manual = $("overtime-mode").value === "manual";
    $("overtime-period").hidden = !manual;
    $("overtime-overnight").hidden = !manual;
    for (const id of ["overtime-date", "overtime-start", "overtime-end"]) $(id).required = manual;
    $("overtime-performed-field").hidden = !manual;
    $("overtime-performed-work").required = manual;
    $("overtime-performed-work").disabled = !manual;
    $("overtime-eligibility").textContent = approvers.length ? "Escolha um ADMIN diferente de você. Só o responsável designado poderá analisar esta ocorrência." : "Nenhum ADMIN elegível está disponível. Um responsável com acesso administrativo ativo precisa ser configurado antes do envio.";
    $("overtime-save").textContent = manual ? "Registrar período" : "Iniciar cronômetro";
    $("overtime-save").disabled = !approvers.length || !manual && Boolean(active);
  }
  async function team() {
    const generation = epoch, sequence = ++teamSequence, offset = teamOffset;
    try {
      const result = await api("admin-team", { query: `&month=${$("team-month").value}&q=${encodeURIComponent($("team-search").value)}&offset=${teamOffset}` });
      if (generation !== epoch || sequence !== teamSequence || !enabled) return;
      people = result.users;
      teamNext = result.nextOffset;
      $("team-updated").textContent = `Atualizado às ${new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(result.serverTime))}. Atualização a cada 30 segundos.`;
      const sums = people.reduce((a, p) => ({ late: a.late + p.metrics.lateMinutes, extra: a.extra + p.metrics.extraMinutes, approved: a.approved + (p.overtime.find((r) => r.status === "approved")?.minutes || 0), holiday: a.holiday + (p.metrics.holidayWorkedMinutes || 0), offSchedule: a.offSchedule + (p.metrics.offScheduleWorkedMinutes || 0), weekend: a.weekend + (p.metrics.weekendOffScheduleWorkedMinutes || 0) }), { late: 0, extra: 0, approved: 0, holiday: 0, offSchedule: 0, weekend: 0 });
      $("team-metrics").innerHTML = [["Colaboradores online", String(people.filter((p) => p.online).length)], ["Atrasos no mês", hours(sums.late)], ["Acima da jornada", hours(sums.extra)], ["Horas extras aprovadas", hours(sums.approved)], ["Trabalhadas em feriados", hours(sums.holiday)], ["Trabalhadas fora da escala", hours(sums.offSchedule)], ["FDS fora da escala", hours(sums.weekend)]].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
      $("team-list").innerHTML = people.length ? `<div class="table-scroll"><table class="records-table team-table"><thead><tr><th>Colaborador</th><th>Atividade / conexão</th><th>Ponto de hoje</th><th>Horas no mês</th><th>Atraso</th><th>Acima da jornada</th><th>Jornada</th></tr></thead><tbody>${people.map((p) => `<tr><td><strong>${esc(p.name)}</strong><span class="admin-email">${esc(p.email)}</span>${p.status !== "active" ? `<span class="field-hint">${p.status === "pending" ? "Acesso pendente" : "Acesso bloqueado"}</span>` : ""}</td><td><strong>${esc(p.activityLabel)}</strong><span class="presence-state ${p.online ? "connected" : ""}">${p.online ? "Online" : "Sem conexão recente"}</span>${p.lastSeen ? `<small class="admin-email">Último contato ${esc(when(p.lastSeen))}</small>` : ""}</td><td>${p.today ? esc(p.today.times.join(" | ") || "Sem marcação") : "Sem marcação"}${calendarBadge(p.today ? { ...p.todayContext, ...p.today } : p.todayContext)}${p.today?.incomplete ? '<span class="status pending">Em aberto</span>' : ""}</td><td>${hours(p.metrics.minutes)}${p.metrics.incomplete ? `<span class="admin-email">${p.metrics.incomplete} ${p.metrics.incomplete === 1 ? "dia" : "dias"} em aberto</span>` : ""}</td><td>${p.metrics.scheduledDays ? hours(p.metrics.lateMinutes) : "—"}</td><td>${p.metrics.scheduledDays ? hours(p.metrics.extraMinutes) : "—"}</td><td><span class="admin-email">${p.schedule ? esc(p.schedule.start_time + " a " + p.schedule.end_time) : "Não configurada"}</span><button class="text-button" data-schedule-uid="${esc(p.uid)}">Configurar</button></td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-state">Nenhum colaborador encontrado.</div>';
      $("team-prev").disabled = offset === 0;
      $("team-next").disabled = teamNext === null;
      $("team-page").textContent = `Página ${offset / 50 + 1}`;
    } catch (error) {
      if (generation === epoch && sequence === teamSequence) fail(error, "team-error");
    }
  }
  async function reviews() {
    const generation = epoch, sequence = ++reviewSequence, offset = reviewOffset;
    try {
      const result = await api("admin-overtime", { query: `&month=${$("team-month").value}&status=${$("review-status").value}&offset=${reviewOffset}` });
      if (generation !== epoch || sequence !== reviewSequence || !enabled) return;
      requests = result.rows;
      reviewNext = result.nextOffset;
      $("review-list").innerHTML = requests.length ? requests.map((r) => occurrence(r, true)).join("") : '<div class="empty-state">Nenhuma ocorrência para analisar neste período.</div>';
      $("review-prev").disabled = offset === 0;
      $("review-next").disabled = reviewNext === null;
      $("review-page").textContent = `Página ${offset / 50 + 1}`;
    } catch (error) {
      if (generation === epoch && sequence === reviewSequence) fail(error, "team-error");
    }
  }
  function editSchedule(uid) {
    selected = people.find((p) => p.uid === uid);
    if (!selected) return;
    $("schedule-form").reset();
    $("schedule-person").textContent = selected.name;
    $("schedule-date").value = today();
    $("schedule-date").max = today();
    const s = selected.schedule;
    $("schedule-start").value = s?.start_time || "09:00";
    $("schedule-end").value = s?.end_time || "16:00";
    $("schedule-break").value = s?.break_minutes || 0;
    $("schedule-tolerance").value = s?.tolerance_minutes || 0;
    for (const input of $("schedule-form").querySelectorAll("[name=weekday]")) input.checked = (s ? JSON.parse(s.weekdays) : [1, 2, 3, 4, 5]).includes(Number(input.value));
    $("schedule-dialog").showModal();
  }
  $("activity-select").onchange = () => beat($("activity-select").value);
  $("overtime-mode").onchange = mode;
  $("overtime-month").onchange = mine;
  $("overtime-form").onsubmit = async (event) => {
    event.preventDefault();
    $("journey-error").hidden = true;
    if (!approvers.length) {
      fail(new Error("Não há ADMIN elegível para analisar a ocorrência."));
      mode();
      return;
    }
    const manual = $("overtime-mode").value === "manual";
    const data = { reason: $("overtime-reason").value, requestedBy: $("overtime-requester").value, requestedWork: $("overtime-requested-work").value, approverUid: $("overtime-approver").value };
    if (manual) Object.assign(data, { date: $("overtime-date").value, start: $("overtime-start").value, end: $("overtime-end").value, performedWork: $("overtime-performed-work").value });
    try {
      await busy($("overtime-save"), () => mutate(manual ? "overtime-register" : "overtime-start", data));
      if (manual) $("overtime-month").value = data.date.slice(0, 7);
      $("overtime-form").reset();
      $("overtime-date").value = today();
      toast(manual ? "Ocorrência enviada ao responsável escolhido." : "Cronômetro iniciado. Informe a entrega ao encerrar.");
      await mine();
    } catch (error) {
      fail(error);
      mode();
    }
  };
  async function stopRecord(row, performedWork, button) {
    const data = { id: row.id, version: row.version };
    if (!legacy(row)) data.performedWork = performedWork;
    await busy(button, () => mutate("overtime-stop", data));
    $("overtime-stop-dialog").close();
    closingRecord = null;
    $("overtime-month").value = row.work_date.slice(0, 7);
    toast("Período encerrado e enviado para análise.");
    await mine();
  }
  $("overtime-stop").onclick = async () => {
    if (!active) return;
    if (legacy(active)) {
      try {
        await stopRecord(active, void 0, $("overtime-stop"));
      } catch (error) {
        fail(error);
      }
      return;
    }
    closingRecord = { ...active };
    $("overtime-stop-form").reset();
    $("stop-error").hidden = true;
    $("overtime-stop-summary").textContent = `Solicitado: ${active.requested_work} · Aprovação: ${approverLabel(active)}`;
    $("overtime-stop-dialog").showModal();
  };
  $("stop-cancel").onclick = () => {
    $("overtime-stop-dialog").close();
    closingRecord = null;
  };
  $("overtime-stop-form").onsubmit = async (event) => {
    event.preventDefault();
    if (!closingRecord) return;
    $("stop-error").hidden = true;
    try {
      await stopRecord(closingRecord, $("stop-performed-work").value, $("stop-save"));
    } catch (error) {
      fail(error, "stop-error");
    }
  };
  function assignmentMode() {
    $("assign-save").disabled = !approvers.length || !$("assign-approver").value || $("assign-approver").value === assigningRecord?.approver_uid;
  }
  $("my-overtime-list").onclick = (event) => {
    const button = event.target.closest("[data-assign-id]");
    if (!button) return;
    assigningRecord = ownRows.find((row) => row.id === button.dataset.assignId && row.can_reassign === true);
    if (!assigningRecord) return;
    $("overtime-assign-form").reset();
    $("assign-error").hidden = true;
    $("overtime-assign-person").textContent = `${when(assigningRecord.start_at)} · Responsável atual: ${approverLabel(assigningRecord)}`;
    fillApprovers($("assign-approver"), assigningRecord.approver_uid);
    $("assign-hint").textContent = approvers.length ? "O novo responsável passa a analisar esta ocorrência e precisa ser um ADMIN diferente de você." : "Não há outro ADMIN elegível. Peça a configuração de um responsável antes de trocar.";
    assignmentMode();
    $("overtime-assign-dialog").showModal();
  };
  $("assign-approver").onchange = assignmentMode;
  $("assign-cancel").onclick = () => {
    $("overtime-assign-dialog").close();
    assigningRecord = null;
  };
  $("overtime-assign-form").onsubmit = async (event) => {
    event.preventDefault();
    if (!assigningRecord) return;
    $("assign-error").hidden = true;
    try {
      await busy($("assign-save"), () => mutate("overtime-assign", { id: assigningRecord.id, version: assigningRecord.version, approverUid: $("assign-approver").value }));
      $("overtime-assign-dialog").close();
      assigningRecord = null;
      toast("Responsável atualizado.");
      await mine();
    } catch (error) {
      fail(error, "assign-error");
      assignmentMode();
    }
  };
  $("team-filter").onsubmit = (event) => {
    event.preventDefault();
    teamOffset = reviewOffset = 0;
    $("team-error").hidden = true;
    team();
    reviews();
  };
  $("team-list").onclick = (event) => {
    const button = event.target.closest("[data-schedule-uid]");
    if (button) editSchedule(button.dataset.scheduleUid);
  };
  $("team-prev").onclick = () => {
    teamOffset = Math.max(0, teamOffset - 50);
    team();
  };
  $("team-next").onclick = () => {
    if (teamNext !== null) {
      teamOffset = teamNext;
      team();
    }
  };
  $("review-status").onchange = () => {
    reviewOffset = 0;
    reviews();
  };
  $("review-prev").onclick = () => {
    reviewOffset = Math.max(0, reviewOffset - 50);
    reviews();
  };
  $("review-next").onclick = () => {
    if (reviewNext !== null) {
      reviewOffset = reviewNext;
      reviews();
    }
  };
  $("schedule-cancel").onclick = () => $("schedule-dialog").close();
  $("review-cancel").onclick = () => $("review-dialog").close();
  $("schedule-form").onsubmit = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const date = $("schedule-date").value, previous = selected.schedules.find((s) => s.effective_date === date);
    try {
      await busy($("schedule-save"), () => api("admin-schedule", { method: "POST", data: { uid: selected.uid, version: previous?.version || 0, effectiveDate: date, start: $("schedule-start").value, end: $("schedule-end").value, breakMinutes: Number($("schedule-break").value), toleranceMinutes: Number($("schedule-tolerance").value), weekdays: [...$("schedule-form").querySelectorAll("[name=weekday]:checked")].map((input) => Number(input.value)), reason: $("schedule-reason").value } }));
      $("schedule-dialog").close();
      toast("Jornada configurada.");
      await Promise.all([team(), mine()]);
    } catch (error) {
      toast(error.message, true);
    }
  };
  $("review-list").onclick = (event) => {
    const button = event.target.closest("[data-review-id]");
    if (!button) return;
    decision = requests.find((row) => row.id === button.dataset.reviewId && row.can_review === true);
    if (!decision) return;
    $("review-form").reset();
    $("review-error").hidden = true;
    $("review-person").textContent = `${decision.name} · ${when(decision.start_at)} · ${hours(decision.minutes)}`;
    $("review-summary").innerHTML = details(decision);
    $("review-dialog").showModal();
  };
  $("review-form").onsubmit = async (event) => {
    event.preventDefault();
    if (!decision) return;
    $("review-error").hidden = true;
    try {
      await busy($("review-save"), () => mutate("admin-overtime-review", { id: decision.id, version: decision.version, status: $("review-decision").value, reason: $("review-reason").value }));
      $("review-dialog").close();
      decision = null;
      toast("Análise registrada.");
      await Promise.all([reviews(), team(), mine()]);
    } catch (error) {
      fail(error, "review-error");
    }
  };
  const teamVisible = () => enabled && getUser()?.role === "admin" && !$("view-admin").hidden && !teamHost.hidden;
  async function openAdmin() {
    if (!teamVisible()) return;
    if (!$("team-month").value) $("team-month").value = currentMonth();
    $("team-error").hidden = true;
    await Promise.all([team(), reviews()]);
  }
  document.addEventListener("ponto:admin-tab", (event) => {
    if (event.detail?.tab === "team") openAdmin();
  });
  const clock = setInterval(tick, 1e3);
  document.addEventListener("visibilitychange", () => {
    if (enabled && !document.hidden) {
      beat();
      if (!$("view-jornada").hidden) mine();
      if (teamVisible()) openAdmin();
    }
  });
  function start() {
    if (enabled) return;
    enabled = true;
    if (!$("overtime-month").value) $("overtime-month").value = currentMonth();
    $("overtime-date").value = today();
    $("overtime-date").max = today();
    if (!heartbeat) heartbeat = setInterval(() => {
      if (!document.hidden) beat();
    }, 6e4);
    if (!refresh) refresh = setInterval(() => {
      if (!document.hidden && teamVisible()) openAdmin();
    }, 3e4);
    return beat();
  }
  return { start, async open() {
    await Promise.all([start(), mine()]);
  }, openAdmin, reset() {
    enabled = false;
    epoch++;
    pendingHeartbeat = false;
    active = null;
    ownRows = [];
    approvers = [];
    people = [];
    requests = [];
    selected = decision = closingRecord = assigningRecord = null;
    mutationKeys.clear();
    clearInterval(heartbeat);
    clearInterval(refresh);
    heartbeat = refresh = null;
    teamOffset = reviewOffset = 0;
    for (const id of ["schedule-dialog", "review-dialog", "overtime-stop-dialog", "overtime-assign-dialog"]) $(id).close();
    for (const id of ["overtime-form", "overtime-stop-form", "overtime-assign-form", "review-form"]) $(id).reset();
    for (const id of ["team-list", "review-list", "my-overtime-list", "team-metrics", "review-summary"]) $(id).innerHTML = "";
    for (const id of ["journey-error", "team-error", "stop-error", "assign-error", "review-error"]) $(id).hidden = true;
    fillApprovers($("overtime-approver"));
    mode();
  } };
}
export {
  createJourney
};
