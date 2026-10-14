import { createProvenance } from "../history/provenance.mjs?v=phase2-finish-1";
import { recordStatus, sourceLabel, calendarTotals } from "../calendar/presentation.mjs?v=phase2-finish-1";
import { $, escapeHTML as esc } from "../../shared/dom.mjs?v=phase2-finish-1";
const labels = { pending: "Aguardando aprovação", active: "Liberado", blocked: "Bloqueado", recorded: "Marcações de ponto", weekend: "Fim de semana", not_applicable: "Não se aplica", medical: "Atestado" };
const recordText = (row) => !row ? "Sem registro" : row.times?.length ? row.times.join(" | ") : labels[row.status] || "Sem marcações";
function createAdmin({ api, busy, toast, formatDate, hours, currentMonth, currentParts, onCorrection }) {
  const provenance = createProvenance({ api, formatDate });
  let team = [], choices = [], records = [], selected = null, tab = "team", access = null, correction = null, usersOffset = 0, historyOffset = 0, usersNext = null, historyNext = null, epoch = 0, usersSequence = 0, historySequence = 0;
  const report = (error) => {
    $("#admin-error").textContent = error.message;
    $("#admin-error").hidden = false;
  };
  const clearError = () => $("#admin-error").hidden = true;
  const today = () => {
    const p = currentParts();
    return `${p.year}-${p.month}-${p.day}`;
  };
  function chooseOptions(rows) {
    choices = rows;
    for (const [id, empty] of [["admin-employee", "Selecione um funcionário"], ["admin-history-employee", "Toda a equipe"]]) {
      const el = $("#" + id), old = el.value, list = selected && !rows.some((u) => u.uid === selected.uid) ? [selected, ...rows] : rows;
      el.innerHTML = `<option value="">${empty}</option>` + list.map((u) => `<option value="${esc(u.uid)}">${esc(u.name)} · ${esc(u.email)}</option>`).join("");
      if (list.some((u) => u.uid === old)) el.value = old;
    }
  }
  async function users() {
    clearError();
    const generation = epoch, sequence = ++usersSequence, offset = usersOffset;
    $("#admin-users-table").innerHTML = '<div class="empty-state">Carregando funcionários…</div>';
    try {
      const result = await api("admin-users", { query: `&q=${encodeURIComponent($("#admin-search").value.trim())}&status=${$("#admin-status").value}&offset=${usersOffset}` });
      if (generation !== epoch || sequence !== usersSequence) return;
      team = result.users;
      usersNext = result.nextOffset;
      for (const status of ["pending", "active", "blocked"]) $("#admin-count-" + status).textContent = result.counts[status] || 0;
      $("#admin-users-table").innerHTML = team.length ? `<div class="table-scroll"><table class="records-table admin-users-table"><thead><tr><th>Funcionário</th><th>Acesso</th><th>Ações</th></tr></thead><tbody>${team.map((u) => `<tr><td><strong>${esc(u.name)}</strong><span class="admin-email">${esc(u.email)}</span></td><td><span class="status ${u.status === "blocked" ? "blocked" : u.status === "pending" ? "pending" : ""}">${u.role === "admin" ? "ADMIN" : labels[u.status]}</span></td><td><div class="admin-row-actions"><button class="text-button" data-records-uid="${esc(u.uid)}">Ver ponto</button>${u.role === "admin" ? '<span class="field-hint">Acesso protegido</span>' : `<button class="button ${u.status === "active" ? "secondary" : "primary"} small" data-access-uid="${esc(u.uid)}" data-status="${u.status === "active" ? "blocked" : "active"}">${u.status === "active" ? "Bloquear" : u.status === "blocked" ? "Reativar" : "Aprovar"}</button>`}</div></td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-state"><strong>Nenhum cadastro encontrado.</strong><span>Os funcionários aparecem após tentar entrar no site.</span></div>';
      $("#admin-users-prev").disabled = offset === 0;
      $("#admin-users-next").disabled = usersNext === null;
      $("#admin-users-page").textContent = `Página ${offset / 50 + 1}`;
      chooseOptions(team);
    } catch (error) {
      if (generation !== epoch || sequence !== usersSequence) return;
      report(error);
      $("#admin-users-table").innerHTML = '<div class="empty-state">Não foi possível carregar a equipe. Use Buscar para tentar novamente.</div>';
    }
  }
  async function showTab(next, { load = true, scroll = true, notify = true } = {}) {
    if (!["team", "users", "records", "history"].includes(next)) next = "team";
    tab = next;
    clearError();
    for (const button of document.querySelectorAll("[data-admin-tab]")) {
      button.classList.toggle("active", button.dataset.adminTab === next);
      button.setAttribute("aria-pressed", String(button.dataset.adminTab === next));
      button.setAttribute("aria-controls", button.dataset.adminTab === "team" ? "team-panel" : `admin-panel-${button.dataset.adminTab}`);
    }
    for (const panel of document.querySelectorAll(".admin-panel")) panel.hidden = panel.id !== `admin-panel-${next}`;
    const teamPanel = $("#team-panel");
    if (teamPanel) teamPanel.hidden = next !== "team";
    if (notify) document.dispatchEvent(new CustomEvent("ponto:admin-tab", { detail: { tab: next } }));
    if (scroll) {
      const tabs = $("#view-admin .admin-tabs"), rect = tabs.getBoundingClientRect(), header = $(".topbar")?.getBoundingClientRect().height || 0;
      if (rect.top < header + 12 || rect.bottom > window.innerHeight) window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - header - 12), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
    if (!load) return;
    if (next === "users") await users();
    if (["records", "history"].includes(next) && !choices.length) await users();
    if (tab !== next) return;
    if (next === "history") await history();
    if (next === "records" && $("#admin-employee").value) await loadRecords();
  }
  async function loadRecords() {
    clearError();
    const uid = $("#admin-employee").value, generation = ++epoch;
    records = [];
    selected = null;
    $("#admin-add-record").disabled = true;
    $("#admin-record-summary").textContent = "";
    if (!uid) {
      $("#admin-records-table").innerHTML = '<div class="empty-state">Selecione um funcionário para consultar e corrigir o ponto.</div>';
      return;
    }
    $("#admin-records-table").innerHTML = '<div class="empty-state">Carregando registros…</div>';
    try {
      const result = await api("admin-records", { query: `&uid=${encodeURIComponent(uid)}&month=${$("#admin-month").value}` });
      if (generation !== epoch) return;
      selected = result.user;
      records = result.rows;
      $("#admin-add-record").disabled = false;
      $("#admin-record-summary").textContent = `${selected.name} · ${records.filter((row) => row.times.length).length} dias com ponto · ${hours(records.reduce((n, row) => n + row.minutes, 0))}`;
      $("#admin-records-table").innerHTML = records.length ? `<div class="table-scroll"><table class="records-table"><thead><tr><th>Data</th><th>Marcações / ocorrência</th><th>Horas</th><th>Origem</th><th>Ajuste</th></tr></thead><tbody>${records.map((row) => `<tr><td>${esc(formatDate(row.date))}${recordStatus(row)}</td><td class="times">${row.times.length ? esc(recordText(row)) : "—"}${row.incomplete ? '<span class="admin-email">Saída em aberto</span>' : ""}</td><td>${row.times.length ? hours(row.minutes) : "—"}</td><td><span class="source-label">${sourceLabel(row)}</span></td><td><button class="text-button" data-correct-date="${row.date}">${row.virtual ? "Adicionar marcação" : "Corrigir"}</button></td></tr>`).join("")}</tbody></table></div>${result.summary ? `<div class="calendar-summary">${calendarTotals(result.summary, hours)}</div>` : ""}` : '<div class="empty-state"><strong>Nenhum registro neste mês.</strong><span>Use Adicionar dia para registrar um ponto ausente, com justificativa.</span></div>';
    } catch (error) {
      report(error);
      $("#admin-records-table").innerHTML = '<div class="empty-state">Não foi possível carregar o ponto. Selecione novamente o funcionário.</div>';
    }
  }
  function openAccess(uid, status) {
    const person = team.find((u) => u.uid === uid);
    if (!person) return;
    access = { ...person, nextStatus: status };
    $("#admin-access-title").textContent = status === "active" ? person.status === "blocked" ? "Reativar acesso?" : "Aprovar acesso?" : "Bloquear acesso?";
    $("#admin-access-person").textContent = `${person.name} · ${person.email}`;
    $("#admin-access-description").textContent = status === "active" ? "O funcionário poderá entrar e registrar seu ponto." : "As sessões serão encerradas. Os registros anteriores serão preservados.";
    $("#admin-access-reason").value = status === "active" ? "Cadastro conferido pela empresa." : "";
    $("#admin-access-error").hidden = true;
    $("#admin-access-dialog").showModal();
  }
  function correctionPreview() {
    const recorded = $("#admin-correction-status").value === "recorded";
    $("#admin-correction-times-field").hidden = !recorded;
    $("#admin-correction-times").required = recorded;
    const times = $("#admin-correction-times").value.split("|").map((t) => t.trim()).filter(Boolean);
    $("#admin-correction-preview").textContent = recorded && times.length % 2 === 1 ? "Há uma entrada sem saída. O dia ficará em aberto." : recorded ? "Os intervalos completos serão somados após salvar." : "Esta ocorrência não soma horas.";
  }
  function openCorrection(date) {
    if (!selected) return;
    const row = records.find((r) => r.date === date);
    const existing = row && !row.virtual;
    correction = { uid: selected.uid, version: existing ? row.version || 0 : 0 };
    $("#admin-correction-form").reset();
    $("#admin-correction-title").textContent = existing ? "Ajustar registro" : "Adicionar marcação ausente";
    $("#admin-correction-person").textContent = `${selected.name} · ${selected.email}`;
    $("#admin-correction-before").textContent = existing ? recordText(row) : row ? `${row.label} · informação do calendário, sem marcação armazenada.` : "Sem registro";
    $("#admin-correction-date").value = date || ($("#admin-month").value === currentMonth() ? today() : $("#admin-month").value + "-01");
    $("#admin-correction-date").readOnly = Boolean(existing);
    $("#admin-correction-date").max = today();
    $("#admin-correction-status").value = existing ? row.status : "recorded";
    $("#admin-correction-times").value = row?.times.join(" | ") || "";
    $("#admin-correction-error").hidden = true;
    correctionPreview();
    $("#admin-correction-dialog").showModal();
  }
  async function history() {
    clearError();
    const generation = epoch, sequence = ++historySequence, offset = historyOffset;
    $("#admin-history-list").innerHTML = '<div class="empty-state">Carregando histórico…</div>';
    try {
      const result = await api("admin-history", { query: `&uid=${encodeURIComponent($("#admin-history-employee").value)}&offset=${historyOffset}` });
      if (generation !== epoch || sequence !== historySequence) return;
      historyNext = result.nextOffset;
      $("#admin-history-list").innerHTML = result.events.length ? result.events.map((event) => {
        const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(event.created_at)), point = event.action === "record:correct";
        const schedule = event.action === "schedule:configure", extra = event.action.startsWith("overtime:"), preparation = event.action === "registry:configure";
        const describe = (value) => !value ? "Sem registro anterior" : preparation ? "Dados da etapa futura atualizados." : schedule ? `${value.start_time} a ${value.end_time}, ${value.expected_minutes} min de jornada` : extra ? [{ pending: "Aguardando análise", approved: "Aprovada", rejected: "Recusada", running: "Em andamento" }[value.status] || value.status, value.requested_by && `Solicitante: ${value.requested_by}`, value.requested_work && `Solicitado: ${value.requested_work}`, value.performed_work && `Realizado: ${value.performed_work}`, value.approver_uid && `Responsável: ${value.approver_uid}`].filter(Boolean).join("\n") : point ? recordText(value) : labels[value.status];
        const overtimeTitles = { "overtime:register": "REGISTRO DE HORAS EXTRAS", "overtime:start": "INÍCIO DO CRONÔMETRO", "overtime:stop": "ENCERRAMENTO DO CRONÔMETRO", "overtime:assign": "TROCA DE RESPONSÁVEL", "overtime:approved": "HORAS EXTRAS APROVADAS", "overtime:rejected": "HORAS EXTRAS RECUSADAS" };
        const before = describe(event.before), after = describe(event.after), title = preparation ? "ETAPA FUTURA" : schedule ? "CONFIGURAÇÃO DE JORNADA" : extra ? overtimeTitles[event.action] || "ALTERAÇÃO DE HORAS EXTRAS" : point ? "CORREÇÃO DE PONTO" : "ALTERAÇÃO DE ACESSO";
        return `<article class="admin-event"><div class="admin-event-heading"><div><span class="eyebrow muted">${title}</span><h3>${esc(event.target_name)}${event.date ? " · " + esc(formatDate(event.date)) : ""}</h3><span class="admin-email">${esc(event.target_email)}</span></div><time>${esc(when)}</time></div><div class="admin-comparison"><div><span>Antes</span><strong>${esc(before)}</strong></div><div><span>Depois</span><strong>${esc(after)}</strong></div></div><p class="admin-reason">${esc(event.reason)}</p><p class="admin-event-actor">Alterado por ${esc(event.actor_name)} · ${esc(event.actor_email)}</p></article>`;
      }).join("") : '<div class="history-card empty-state"><strong>Nenhuma alteração administrativa.</strong><span>As aprovações, bloqueios e correções aparecerão aqui.</span></div>';
      $("#admin-history-prev").disabled = offset === 0;
      $("#admin-history-next").disabled = historyNext === null;
      $("#admin-history-page").textContent = `Página ${offset / 50 + 1}`;
    } catch (error) {
      if (generation !== epoch || sequence !== historySequence) return;
      report(error);
      $("#admin-history-list").innerHTML = "";
    }
  }
  $("#admin-users-filter").onsubmit = (event) => {
    event.preventDefault();
    usersOffset = 0;
    users();
  };
  $("#admin-users-prev").onclick = () => {
    usersOffset = Math.max(0, usersOffset - 50);
    users();
  };
  $("#admin-users-next").onclick = () => {
    if (usersNext !== null) {
      usersOffset = usersNext;
      users();
    }
  };
  $("#admin-users-table").onclick = (event) => {
    const action = event.target.closest("[data-access-uid]"), record = event.target.closest("[data-records-uid]");
    if (action) openAccess(action.dataset.accessUid, action.dataset.status);
    if (record) {
      $("#admin-employee").value = record.dataset.recordsUid;
      showTab("records");
    }
  };
  document.querySelectorAll("[data-admin-tab]").forEach((button) => button.onclick = () => showTab(button.dataset.adminTab));
  $("#admin-record-filter").onsubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await api("admin-users", { query: "&q=" + encodeURIComponent($("#admin-record-search").value.trim()) });
      chooseOptions(result.users);
      if (result.users.length === 1) {
        $("#admin-employee").value = result.users[0].uid;
        await loadRecords();
      } else toast(`${result.users.length} funcionários encontrados. Selecione na lista.`);
    } catch (error) {
      report(error);
    }
  };
  $("#admin-employee").onchange = loadRecords;
  $("#admin-month").onchange = loadRecords;
  $("#admin-records-table").onclick = (event) => {
    const button = event.target.closest("[data-correct-date]");
    if (button) openCorrection(button.dataset.correctDate);
  };
  $("#admin-add-record").onclick = () => openCorrection();
  $("#admin-correction-status").onchange = correctionPreview;
  $("#admin-correction-times").oninput = correctionPreview;
  const provenanceButton = document.createElement("button");
  provenanceButton.type = "button";
  provenanceButton.id = "admin-correction-provenance";
  provenanceButton.className = "button secondary";
  provenanceButton.textContent = "Histórico do registro";
  $("#admin-correction-before").insertAdjacentElement("afterend", provenanceButton);
  provenanceButton.onclick = () => {
    if (selected) provenance.open(selected, $("#admin-correction-date").value);
  };
  $("#admin-access-cancel").onclick = () => $("#admin-access-dialog").close();
  $("#admin-correction-cancel").onclick = () => $("#admin-correction-dialog").close();
  $("#admin-access-form").onsubmit = async (event) => {
    event.preventDefault();
    if (!access) return;
    $("#admin-access-error").hidden = true;
    $("#admin-access-cancel").disabled = true;
    try {
      await busy($("#admin-access-save"), () => api("admin-access", { method: "POST", data: { uid: access.uid, version: access.version, status: access.nextStatus, reason: $("#admin-access-reason").value } }), "Salvando…");
      $("#admin-access-dialog").close();
      toast(access.nextStatus === "active" ? "Acesso liberado." : "Acesso bloqueado.");
      await users();
    } catch (error) {
      $("#admin-access-error").textContent = error.message;
      $("#admin-access-error").hidden = false;
    } finally {
      $("#admin-access-cancel").disabled = false;
    }
  };
  $("#admin-correction-form").onsubmit = async (event) => {
    event.preventDefault();
    if (!correction) return;
    $("#admin-correction-error").hidden = true;
    $("#admin-correction-cancel").disabled = true;
    const status = $("#admin-correction-status").value, times = status === "recorded" ? $("#admin-correction-times").value.split("|").map((t) => t.trim()).filter(Boolean) : [];
    try {
      await busy($("#admin-correction-save"), () => api("admin-correct", { method: "POST", data: { ...correction, date: $("#admin-correction-date").value, status, times, reason: $("#admin-correction-reason").value } }), "Salvando…");
      $("#admin-correction-dialog").close();
      toast("Correção salva com justificativa e histórico.");
      await loadRecords();
      onCorrection();
    } catch (error) {
      $("#admin-correction-error").textContent = error.message;
      $("#admin-correction-error").hidden = false;
    } finally {
      $("#admin-correction-cancel").disabled = false;
    }
  };
  $("#admin-refresh-history").onclick = () => {
    historyOffset = 0;
    history();
  };
  $("#admin-history-employee").onchange = () => {
    historyOffset = 0;
    history();
  };
  $("#admin-history-prev").onclick = () => {
    historyOffset = Math.max(0, historyOffset - 50);
    history();
  };
  $("#admin-history-next").onclick = () => {
    if (historyNext !== null) {
      historyOffset = historyNext;
      history();
    }
  };
  showTab("team", { load: false, scroll: false, notify: false });
  return { async open() {
    if (!$("#admin-month").value) $("#admin-month").value = currentMonth();
    await showTab(tab, { scroll: false, notify: false });
  }, reset() {
    epoch++;
    team = [];
    choices = [];
    records = [];
    selected = null;
    access = null;
    correction = null;
    usersOffset = historyOffset = 0;
    provenance.reset();
    for (const id of ["admin-users-table", "admin-records-table", "admin-history-list"]) $("#" + id).innerHTML = "";
    chooseOptions([]);
    for (const id of ["admin-access-dialog", "admin-correction-dialog"]) $("#" + id).close();
    showTab("team", { load: false, scroll: false, notify: false });
  } };
}
export {
  createAdmin
};
