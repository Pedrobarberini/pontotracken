import { calendarContext, enrichCalendar, projectMonth, calendarSummary } from "../calendar.mjs?v=phase2-finish-1";
const labels = { available: "Disponível", lunch: "Almoço", break: "Pausa rápida", meeting: "Reunião", external: "Externo", offline: "Offline" };
const baseSchedule = { start_time: "09:00", end_time: "16:00", break_minutes: 0, expected_minutes: 420, tolerance_minutes: 5, weekdays: "[1,2,3,4,5]", version: 1, effective_date: "2020-01-01" };
function createJourneyDemo({ clock = () => /* @__PURE__ */ new Date() } = {}) {
  const now = () => new Date(clock()).toISOString();
  const users = [{ uid: "presentation", name: "Visitante", email: "visitante@exemplo.test", status: "active", role: "admin", version: 0 }, { uid: "ana", name: "Ana Costa", email: "ana@exemplo.test", status: "active", role: "employee", version: 0 }, { uid: "bruno", name: "Bruno Lima", email: "bruno@exemplo.test", status: "active", role: "employee", version: 0 }, { uid: "carla", name: "Carla Sousa", email: "carla@exemplo.test", status: "pending", role: "employee", version: 0 }, { uid: "demo-marina", name: "Marina Alves", email: "marina@exemplo.test", status: "active", role: "admin", version: 0 }, { uid: "demo-rafael", name: "Rafael Melo", email: "rafael@exemplo.test", status: "active", role: "admin", version: 0 }];
  const schedules = new Map(users.map((u) => [u.uid, [{ ...baseSchedule, uid: u.uid }]]));
  const presence = new Map(users.map((u, i) => [u.uid, { uid: u.uid, activity: ["available", "meeting", "lunch", "offline"][i] || "available", last_seen: now(), changed_at: now() }]));
  const overtime = [], events = [];
  let seeded = false;
  const mutations = /* @__PURE__ */ new Map();
  const seconds = (time) => {
    const [hour, minute, second = 0] = time.split(":").map(Number);
    return hour * 3600 + minute * 60 + second;
  };
  const decorateDay = (row) => ({ ...row, version: row.version || 1, minutes: Math.floor(row.times.reduce((sum, time, index) => index % 2 ? sum + seconds(time) - seconds(row.times[index - 1]) : sum, 0) / 60), incomplete: row.times.length % 2 === 1, label: row.times.length % 2 ? "Em aberto" : { recorded: "Registrado", weekend: "Fim de semana", medical: "Atestado", not_applicable: "Não se aplica" }[row.status] });
  const fail = (message, status = 400) => {
    const e = new Error(message);
    e.status = status;
    throw e;
  };
  const text = (value, min, max, label) => {
    if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) fail(label);
    return value.trim();
  };
  const eligible = (actorUid, uid) => users.find((user) => user.uid === uid && user.uid !== actorUid && user.role === "admin" && user.status === "active");
  const publicApprovers = (actorUid) => users.filter((user) => eligible(actorUid, user.uid)).map(({ uid, name, email }) => ({ uid, name, email }));
  const decorate = (row, actorUid = "presentation") => {
    const actor = users.find((user) => user.uid === actorUid), approver = users.find((user) => user.uid === row.approver_uid);
    return { ...row, requested_work: row.requested_work ?? null, performed_work: row.performed_work ?? null, approver_uid: row.approver_uid ?? null, approver_name: approver?.name ?? null, approver_email: approver?.email ?? null, can_reassign: row.uid === actorUid && ["running", "pending"].includes(row.status), can_review: actor?.role === "admin" && actor.status === "active" && row.status === "pending" && row.uid !== actorUid && (!row.approver_uid || row.approver_uid === actorUid), minutes: Math.max(0, Math.floor((Date.parse(row.end_at || now()) - Date.parse(row.start_at)) / 6e4)) };
  };
  return function journeyDemo2(action, { data = {}, query = "", dateNow, days, parseCell, actorUid = "presentation" }) {
    if (!seeded) {
      seeded = true;
      const d = /* @__PURE__ */ new Date(dateNow() + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      const date = d.toISOString().slice(0, 10);
      overtime.push({ id: "demo-extra-ana", uid: "ana", work_date: date, start_at: date + "T19:00:00Z", end_at: date + "T20:15:00Z", reason: "Atendimento adicional de chamado urgente.", requested_by: "Coordenação", requested_work: null, performed_work: null, approver_uid: null, status: "pending", version: 1, created_at: now() });
      overtime.push({ id: "demo-extra-bruno", uid: "bruno", work_date: date, start_at: date + "T20:00:00Z", end_at: date + "T20:40:00Z", reason: "A conferência dependeu da conclusão da manutenção.", requested_by: "Gestão de exemplo", requested_work: "Conferir a importação de chamados da equipe.", performed_work: "Chamados conferidos e resultado registrado no relatório.", approver_uid: "presentation", status: "pending", version: 1, created_at: now() });
    }
    const actor = users.find((user) => user.uid === actorUid);
    if (!actor || actor.status !== "active") fail("Conta demonstrativa indisponível.", 403);
    if (action.startsWith("admin-") && actor.role !== "admin") fail("Acesso restrito ao administrador.", 403);
    const params = new URLSearchParams(query.replace(/^&/, "")), month = params.get("month") || dateNow().slice(0, 7), offset = Number(params.get("offset") || 0);
    if (action === "demo-calendar") return { schedules: schedules.get(actorUid) || [] };
    let mutationKey = null, signature = null;
    if ((action.startsWith("overtime-") || action === "admin-overtime-review") && data.requestId !== void 0) {
      if (typeof data.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(data.requestId)) fail("Identificador de envio inválido.");
      mutationKey = actorUid + ":" + action + ":" + data.requestId;
      const fields = Object.entries(data).filter(([key]) => key !== "requestId").sort(([a], [b]) => a.localeCompare(b));
      signature = JSON.stringify(Object.fromEntries(fields));
      const cached = mutations.get(mutationKey);
      if (cached) {
        if (cached.signature !== signature) fail("Este envio já foi usado com outros dados.", 409);
        return structuredClone(cached.result);
      }
    }
    const result = (value) => {
      if (mutationKey) mutations.set(mutationKey, { signature, result: structuredClone(value) });
      return value;
    };
    const audit = (action2, row, before, reason) => events.unshift({ id: crypto.randomUUID(), action: action2, target_name: users.find((user) => user.uid === row.uid).name, target_email: users.find((user) => user.uid === row.uid).email, actor_name: actor.name, actor_email: actor.email, date: row.work_date, reason, before, after: { ...row }, created_at: now() });
    if (action === "presence") {
      const p = presence.get(actorUid);
      if (data.activity && !Object.keys(labels).includes(data.activity)) fail("Status inválido.");
      Object.assign(p, { activity: data.activity || p.activity, last_seen: now() });
      return { ...p, label: labels[p.activity], serverTime: now() };
    }
    if (action === "journey") return { rows: overtime.filter((row) => row.uid === actorUid && (row.work_date.startsWith(month) || row.status === "running")).map((row) => decorate(row, actorUid)), approvers: publicApprovers(actorUid), schedule: schedules.get(actorUid).at(-1), presence: presence.get(actorUid), serverTime: now() };
    if (["overtime-register", "overtime-start"].includes(action)) {
      const reason = text(data.reason, 15, 1e3, "Explique por que o trabalho foi fora do horário, de 15 a 1.000 caracteres.");
      const requestedBy = text(data.requestedBy, 2, 180, "Informe quem solicitou o trabalho.");
      const requestedWork = text(data.requestedWork, 15, 2e3, "Descreva o trabalho solicitado, de 15 a 2.000 caracteres.");
      const approver = eligible(actorUid, data.approverUid);
      if (!approver) fail("Escolha um ADMIN ativo diferente de você para analisar.", 403);
      const timer = action === "overtime-start", performedWork = timer ? null : text(data.performedWork, 15, 2e3, "Descreva o trabalho realizado, de 15 a 2.000 caracteres.");
      let start = now(), end = null, date = dateNow();
      if (!timer) {
        date = data.date;
        if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T12:00:00Z")) || (/* @__PURE__ */ new Date(date + "T12:00:00Z")).toISOString().slice(0, 10) !== date) fail("Informe uma data válida.");
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.end)) fail("Informe horários válidos.");
        if (data.start === data.end) fail("O início e o término precisam ser diferentes.");
        start = (/* @__PURE__ */ new Date(date + "T" + data.start + ":00-03:00")).toISOString();
        end = (/* @__PURE__ */ new Date(date + "T" + data.end + ":00-03:00")).toISOString();
        if (end < start) end = new Date(Date.parse(end) + 864e5).toISOString();
        if (Date.parse(end) > Date.parse(now())) fail("O período deve estar concluído.");
      }
      if (overtime.some((row2) => row2.uid === actorUid && row2.status !== "rejected" && row2.start_at < (end || "9999") && (row2.end_at || "9999") > start)) fail("Período sobreposto ou cronômetro já em andamento.", 409);
      const row = { id: crypto.randomUUID(), uid: actorUid, work_date: date, start_at: start, end_at: end, status: end ? "pending" : "running", version: 1, reason, requested_by: requestedBy, requested_work: requestedWork, performed_work: performedWork, approver_uid: approver.uid, created_at: now() };
      overtime.unshift(row);
      return result({ record: decorate(row, actorUid) });
    }
    if (action === "overtime-stop") {
      const row = overtime.find((row2) => row2.id === data.id && row2.uid === actorUid);
      if (!row) fail("Cronômetro não encontrado.", 404);
      if (row.status !== "running" || row.version !== data.version) fail("O cronômetro foi atualizado. Recarregue as ocorrências.", 409);
      const performedWork = row.requested_work == null ? row.performed_work : text(data.performedWork, 15, 2e3, "Descreva o trabalho realizado antes de encerrar, de 15 a 2.000 caracteres.");
      row.end_at = now();
      row.performed_work = performedWork;
      row.status = "pending";
      row.version++;
      return result({ record: decorate(row, actorUid) });
    }
    if (action === "overtime-assign") {
      const row = overtime.find((row2) => row2.id === data.id && row2.uid === actorUid);
      if (!row) fail("Ocorrência não encontrada.", 404);
      if (!["running", "pending"].includes(row.status) || row.version !== data.version) fail("A ocorrência foi atualizada ou já foi analisada.", 409);
      const approver = eligible(actorUid, data.approverUid);
      if (!approver) fail("Escolha um ADMIN ativo diferente de você para analisar.", 403);
      if (row.approver_uid === approver.uid) fail("Este responsável já está designado.", 409);
      const before = { ...row };
      row.approver_uid = approver.uid;
      row.version++;
      audit("overtime:assign", row, before, "Responsável pela aprovação alterado pelo titular.");
      return result({ record: decorate(row, actorUid) });
    }
    if (action === "admin-team") {
      const q = (params.get("q") || "").toLowerCase(), matches = users.filter((u) => (u.name + " " + u.email).toLowerCase().includes(q));
      return { users: matches.slice(offset, offset + 50).map((u, i) => {
        const p = presence.get(u.uid), own = schedules.get(u.uid), approved = overtime.filter((r) => r.uid === u.uid && r.work_date.startsWith(month)), calendar = calendarSummary(projectMonth(u.uid === "presentation" ? [...days.values()].map(decorateDay) : [], month, own, dateNow())), current = u.uid === "presentation" ? days.get(dateNow()) || null : u.status === "active" ? { date: dateNow(), status: "recorded", times: [u.uid === "bruno" ? "09:12" : "09:00"], source: "demo", incomplete: true, label: "Em aberto" } : null;
        return { ...u, activity: p.activity, activityLabel: labels[p.activity], online: u.status === "active" && p.activity !== "offline", lastSeen: p.last_seen, schedule: own.at(-1), schedules: own, today: current ? enrichCalendar(decorateDay(current), own) : null, todayContext: calendarContext(dateNow(), own), metrics: { holidayWorkedMinutes: calendar.holidayWorkedMinutes, offScheduleWorkedMinutes: calendar.offScheduleWorkedMinutes, weekendOffScheduleWorkedMinutes: calendar.weekendOffScheduleWorkedMinutes, minutes: u.uid === "presentation" ? [...days.values()].filter((r) => r.date.startsWith(month)).reduce((s, r) => {
          for (let j = 0; j + 1 < r.times.length; j += 2) s += Number(r.times[j + 1].slice(0, 2)) * 60 + Number(r.times[j + 1].slice(3, 5)) - (Number(r.times[j].slice(0, 2)) * 60 + Number(r.times[j].slice(3, 5)));
          return s;
        }, 0) : u.status === "active" ? 2100 : 0, lateMinutes: u.uid === "bruno" ? 12 : 0, extraMinutes: u.uid === "ana" ? 75 : 0, incomplete: u.uid === "presentation" ? [...days.values()].filter((r) => r.date.startsWith(month) && r.status === "recorded" && r.times.length % 2 === 1).length : u.status === "active" ? 1 : 0, scheduledDays: u.status === "active" ? 5 : 0 }, overtime: ["pending", "approved", "rejected", "running"].map((status) => ({ status, minutes: approved.filter((r) => r.status === status).reduce((s, r) => s + decorate(r).minutes, 0) })) };
      }), nextOffset: null, serverTime: now() };
    }
    if (action === "admin-schedule") {
      const own = schedules.get(data.uid), before = own.find((s) => s.effective_date === data.effectiveDate);
      if ((before?.version || 0) !== data.version) fail("Atualize a jornada.", 409);
      const total = Number(data.end.slice(0, 2)) * 60 + Number(data.end.slice(3)) - (Number(data.start.slice(0, 2)) * 60 + Number(data.start.slice(3))) - data.breakMinutes;
      if (total <= 0) fail("Confira o intervalo da jornada.");
      const after = { uid: data.uid, effective_date: data.effectiveDate, start_time: data.start, end_time: data.end, break_minutes: data.breakMinutes, expected_minutes: total, tolerance_minutes: data.toleranceMinutes, weekdays: JSON.stringify(data.weekdays), version: data.version + 1 };
      if (before) Object.assign(before, after);
      else own.push(after);
      own.sort((a, b) => a.effective_date.localeCompare(b.effective_date));
      events.unshift({ id: crypto.randomUUID(), action: "schedule:configure", target_name: users.find((u) => u.uid === data.uid).name, target_email: "exemplo", actor_name: "Visitante", actor_email: "Demonstração", date: data.effectiveDate, reason: data.reason, before, after, created_at: now() });
      return { schedule: after };
    }
    if (action === "admin-overtime") {
      const rows = overtime.filter((row) => (row.work_date.startsWith(month) || row.status === "running") && (!params.get("status") || row.status === params.get("status"))).map((row) => ({ ...decorate(row, actorUid), name: users.find((user) => user.uid === row.uid).name }));
      return { rows: rows.slice(offset, offset + 50), nextOffset: rows.length > offset + 50 ? offset + 50 : null };
    }
    if (action === "admin-overtime-review") {
      const row = overtime.find((row2) => row2.id === data.id);
      if (!row) fail("Ocorrência não encontrada.", 404);
      if (row.uid === actorUid || row.approver_uid && row.approver_uid !== actorUid) fail("A análise é restrita ao responsável designado, diferente do titular.", 403);
      if (row.status !== "pending" || row.version !== data.version) fail("Ocorrência indisponível para análise.", 409);
      if (!["approved", "rejected"].includes(data.status)) fail("Decisão inválida.");
      const reason = text(data.reason, 10, 1e3, "Justifique a decisão, de 10 a 1.000 caracteres."), before = { ...row };
      row.status = data.status;
      row.version++;
      row.review_reason = reason;
      row.reviewed_by = actorUid;
      row.reviewed_at = now();
      audit("overtime:" + data.status, row, before, reason);
      return result({ record: decorate(row, actorUid) });
    }
    if (action === "admin-users") {
      const q = (params.get("q") || "").toLowerCase(), rows = users.filter((u) => (u.name + " " + u.email).toLowerCase().includes(q) && (!params.get("status") || u.status === params.get("status")));
      return { users: rows.slice(offset, offset + 50), counts: Object.fromEntries(["active", "pending", "blocked"].map((s) => [s, users.filter((u) => u.status === s).length])), nextOffset: null };
    }
    if (action === "admin-access") {
      const user = users.find((u) => u.uid === data.uid);
      if (!user || user.role === "admin" || user.version !== data.version) fail("Acesso protegido ou desatualizado.", 409);
      user.status = data.status;
      user.version++;
      return { user };
    }
    if (action === "admin-records") {
      const uid = params.get("uid"), user = users.find((u) => u.uid === uid);
      if (!user) fail("Funcionário não encontrado.", 404);
      const rows = projectMonth([...days.values()].filter((row) => row.date.startsWith(month)).map(decorateDay), month, schedules.get(uid) || [], dateNow());
      return { user, rows, summary: calendarSummary(rows) };
    }
    if (action === "admin-correct") {
      const before = data.uid === "presentation" ? days.get(data.date) : null;
      if (data.uid === "presentation" && (before?.version ?? (before ? 1 : 0)) !== data.version) fail("O registro mudou. Atualize o ponto antes de salvar.", 409);
      const parsed = data.status === "recorded" ? parseCell(data.times.join(" | ")) : { status: data.status, times: [] };
      const record = { ...parsed, date: data.date, source: "admin", version: data.version + 1 };
      if (data.uid === "presentation") days.set(data.date, record);
      return { record };
    }
    if (action === "admin-history") return { events: events.filter((event) => event.action !== "overtime:assign").slice(offset, offset + 50), nextOffset: null };
    return null;
  };
}
const journeyDemo = createJourneyDemo();
export {
  createJourneyDemo,
  journeyDemo
};
