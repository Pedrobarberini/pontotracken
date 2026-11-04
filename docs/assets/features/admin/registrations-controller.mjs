import { escapeHTML as e } from "../../shared/dom.mjs?v=hr-operations-1";
import { registrationInvitation } from "./registration-invitation.mjs?v=hr-operations-1";

const statusNames = { open: "Aguardando vínculo", linked: "Login vinculado", archived: "Arquivado" };
const reasonField = '<label for="registration-reason">Justificativa</label><textarea id="registration-reason" name="reason" minlength="10" maxlength="1000" rows="3" required></textarea>';

/** Employee preparation and login approval are separate, explicit operations. */
export function createRegistrations({ host, api, toast, onChanged = async () => {} }) {
  if (!host) return { load: async () => {}, reset() {} };
  host.innerHTML = `<section class="history-card registration-card"><div class="card-heading"><div><h2>Novos colaboradores</h2><p>Prepare os dados antes de o colaborador criar seu login.</p></div><button type="button" class="button primary" data-registration-new>Novo colaborador</button></div><p class="field-hint">O pré-cadastro não cria senha nem libera acesso. Depois do cadastro no site, vincule o login pelo e-mail e aprove a conta na lista da equipe.</p><form data-registration-search class="admin-toolbar"><div class="admin-field grow"><label for="registration-search">Buscar pré-cadastro</label><input id="registration-search" type="search" maxlength="180" placeholder="Nome ou e-mail"></div><div class="admin-field"><label for="registration-status">Situação</label><select id="registration-status"><option value="open">Aguardando vínculo</option><option value="linked">Vinculados</option><option value="archived">Arquivados</option></select></div><button class="button secondary">Buscar</button></form><div data-registration-error class="data-error" role="alert" hidden></div><div data-registration-list></div><div class="admin-pagination"><button type="button" class="button secondary" data-registration-prev disabled>Anterior</button><span data-registration-page></span><button type="button" class="button secondary" data-registration-next disabled>Próxima</button></div></section>`;
  const $ = selector => host.querySelector(selector), list = $("[data-registration-list]"), error = $("[data-registration-error]");
  const dialog = document.createElement("dialog");
  dialog.className = "confirm-dialog admin-dialog";
  dialog.setAttribute("aria-label", "Pré-cadastro de colaborador");
  document.body.append(dialog);
  let rows = [], offset = 0, nextOffset = null, epoch = 0, sequence = 0, pending = false, submission = null;
  const report = failure => { error.hidden = false; error.textContent = failure.message; };
  async function load() {
    const generation = epoch, request = ++sequence;
    error.hidden = true;
    list.innerHTML = '<div class="empty-state">Carregando pré-cadastros…</div>';
    try {
      const result = await api("admin-registrations", { query: `&q=${encodeURIComponent($("#registration-search").value.trim())}&status=${$("#registration-status").value}&offset=${offset}` });
      if (generation !== epoch || request !== sequence) return;
      rows = result.rows;
      nextOffset = result.nextOffset;
      list.innerHTML = rows.length ? `<div class="table-scroll"><table class="records-table"><thead><tr><th>Colaborador</th><th>Dados profissionais</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${e(row.name)}</strong><span class="admin-email">${e(row.email)}</span></td><td>${e(row.jobTitle || "Cargo não informado")}<span class="admin-email">${e(row.department || "Área não informada")}${row.employeeNumber ? ` · Matrícula ${e(row.employeeNumber)}` : ""}</span></td><td><span class="status ${row.status === "open" ? "pending" : ""}">${statusNames[row.status]}</span></td><td>${row.status === "open" ? `<div class="admin-row-actions"><button type="button" class="text-button" data-registration-edit="${e(row.id)}">Editar</button><button type="button" class="text-button" data-registration-invite="${e(row.id)}">Copiar convite</button><button type="button" class="button secondary small" data-registration-link="${e(row.id)}">Vincular login</button><button type="button" class="text-button" data-registration-archive="${e(row.id)}">Arquivar</button></div>` : '<span class="field-hint">Histórico preservado</span>'}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-state">Nenhum pré-cadastro nesta busca.</div>';
      $("[data-registration-prev]").disabled = offset === 0;
      $("[data-registration-next]").disabled = nextOffset === null;
      $("[data-registration-page]").textContent = `Página ${offset / 50 + 1}`;
    } catch (failure) { if (generation === epoch && request === sequence) { report(failure); list.innerHTML = '<div class="empty-state">Use Buscar para tentar novamente.</div>'; } }
  }
  function close() { if (!pending) { submission = null; dialog.close(); } }
  dialog.oncancel = event => { if (pending) event.preventDefault(); };
  function show(title, content, action, makeBody, success) {
    submission = null;
    dialog.innerHTML = `<form><h2>${e(title)}</h2>${content}${reasonField}<div data-form-error class="data-error" role="alert" hidden></div><div class="dialog-actions"><button type="button" class="button secondary" data-cancel>Cancelar</button><button class="button primary" data-save>${action === "admin-registration-link" ? "Vincular login" : action === "admin-registration-archive" ? "Arquivar pré-cadastro" : "Salvar pré-cadastro"}</button></div></form>`;
    dialog.querySelector("[data-cancel]").onclick = close;
    const form = dialog.querySelector("form"), formError = dialog.querySelector("[data-form-error]"), save = dialog.querySelector("[data-save]");
    form.oninput = () => { submission = null; formError.hidden = true; };
    form.onsubmit = async event => {
      event.preventDefault();
      if (pending) return;
      formError.hidden = true;
      const body = makeBody(new FormData(form));
      if (body.reason.trim().length < 10 || body.reason.trim().length > 1000) { formError.hidden = false; formError.textContent = "Informe uma justificativa entre 10 e 1.000 caracteres."; return; }
      const signature = JSON.stringify(body);
      if (!submission || signature !== submission.signature) submission = { signature, requestId: crypto.randomUUID() };
      const generation = epoch, label = save.textContent;
      pending = true;
      for (const element of form.elements) element.disabled = true;
      form.setAttribute("aria-busy", "true");
      save.textContent = "Salvando…";
      try {
        await api(action, { method: "POST", data: { ...body, requestId: submission.requestId } });
        if (generation !== epoch) return;
        dialog.close();
        toast(success);
        await Promise.all([load(), onChanged()]);
      } catch (failure) { if (generation === epoch) { formError.hidden = false; formError.textContent = failure.message; } }
      finally { if (generation === epoch) { pending = false; for (const element of form.elements) element.disabled = false; form.setAttribute("aria-busy", "false"); save.textContent = label; } }
    };
    dialog.showModal();
  }
  function edit(row = null) {
    const fields = [["name", "Nome completo", true, 180], ["email", "E-mail do futuro login", true, 254], ["employeeNumber", "Matrícula", false, 40], ["jobTitle", "Cargo", false, 120], ["department", "Área", false, 120]];
    show(row ? "Editar pré-cadastro" : "Novo colaborador", fields.map(([name, label, required, max]) => `<label for="registration-${name}">${label}</label><input id="registration-${name}" name="${name}" type="${name === "email" ? "email" : "text"}" value="${e(row?.[name] || "")}" maxlength="${max}" ${required ? "required" : ""}>`).join(""), "admin-registration-save", form => ({ ...Object.fromEntries(form), ...(row ? { id: row.id } : {}), version: row?.version || 0 }), "Pré-cadastro salvo. O acesso ainda depende do cadastro e aprovação do login.");
  }
  async function invite(row) {
    const generation = epoch, message = registrationInvitation(row, document.baseURI);
    try {
      await navigator.clipboard.writeText(message);
      if (generation === epoch) toast("Convite copiado. Compartilhe com o colaborador pelo canal da empresa.");
    } catch {
      if (generation !== epoch) return;
      dialog.innerHTML = '<h2>Convite de cadastro</h2><p>Selecione e copie o texto para compartilhar com o colaborador.</p><label for="registration-invitation">Mensagem do convite</label><textarea id="registration-invitation" rows="10" readonly></textarea><div class="dialog-actions"><button type="button" class="button secondary" data-cancel>Fechar</button></div>';
      dialog.querySelector('textarea').value = message;
      dialog.querySelector('[data-cancel]').onclick = close;
      dialog.showModal();
      dialog.querySelector('textarea').select();
    }
  }
  async function link(row) {
    const generation = epoch, request = ++sequence;
    error.hidden = true;
    try {
      const result = await api("admin-users", { query: `&q=${encodeURIComponent(row.email)}` });
      if (generation !== epoch || request !== sequence) return;
      const matches = result.users.filter(user => user.email.toLowerCase().trim() === row.email.toLowerCase().trim() && ["pending", "active"].includes(user.status) && !user.accessRevoked);
      if (matches.length !== 1 || result.nextOffset !== null) throw new Error(matches.length === 0 ? "Ainda não há login disponível com este e-mail. Peça ao colaborador que se cadastre no site e tente novamente." : "Há mais de um resultado possível. Revise os cadastros antes de vincular.");
      const user = matches[0], { profile } = await api("people-profile", { query: `&uid=${encodeURIComponent(user.uid)}` });
      if (generation !== epoch || request !== sequence) return;
      show("Vincular login", `<p><strong>${e(row.name)}</strong><br>${e(row.email)}</p><p>Login encontrado: ${e(user.name)}.</p><p class="field-hint">Somente dados profissionais vazios serão preenchidos. O vínculo não aprova nem reativa o acesso; use as ações de acesso da equipe depois.</p>`, "admin-registration-link", form => ({ id: row.id, version: row.version, uid: user.uid, profileVersion: profile.version, reason: form.get("reason") }), "Login vinculado. Confira e aprove o acesso na lista da equipe.");
    } catch (failure) { if (generation === epoch && request === sequence) report(failure); }
  }
  $("[data-registration-new]").onclick = () => { if (!pending) { sequence++; edit(); } };
  $("[data-registration-search]").onsubmit = event => { event.preventDefault(); offset = 0; load(); };
  $("#registration-status").onchange = () => { offset = 0; load(); };
  $("[data-registration-prev]").onclick = () => { offset = Math.max(0, offset - 50); load(); };
  $("[data-registration-next]").onclick = () => { if (nextOffset !== null) { offset = nextOffset; load(); } };
  list.onclick = event => {
    const button = event.target.closest("[data-registration-edit],[data-registration-link],[data-registration-archive],[data-registration-invite]");
    if (!button || pending) return;
    const id = button.dataset.registrationEdit || button.dataset.registrationLink || button.dataset.registrationArchive || button.dataset.registrationInvite, row = rows.find(item => item.id === id && item.status === "open");
    if (!row) return;
    sequence++;
    if (button.dataset.registrationInvite) invite(row);
    else if (button.dataset.registrationEdit) edit(row);
    else if (button.dataset.registrationLink) link(row);
    else show("Arquivar pré-cadastro", `<p>${e(row.name)} · ${e(row.email)}</p><p class="field-hint">O pré-cadastro sairá da lista de pendentes. Isso não altera nenhum acesso existente.</p>`, "admin-registration-archive", form => ({ id: row.id, version: row.version, reason: form.get("reason") }), "Pré-cadastro arquivado.");
  };
  return { load, reset() { epoch++; pending = false; rows = []; offset = 0; nextOffset = null; submission = null; dialog.close(); list.innerHTML = ""; error.hidden = true; $("#registration-search").value = ""; $("#registration-status").value = "open"; } };
}
