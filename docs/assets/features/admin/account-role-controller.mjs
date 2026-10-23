import { $ } from "../../shared/dom.mjs?v=admin-roles-1";

/** Administrative permission is independent from access approval and the employee's RH role. */
export function createAccountRole({ api, toast, getUser, onChanged }) {
  const dialog = $("#admin-role-dialog"), form = $("#admin-role-form");
  const email = $("#admin-role-email"), reason = $("#admin-role-reason");
  const save = $("#admin-role-save"), cancel = $("#admin-role-cancel");
  const error = $("#admin-role-error"), refresh = $("#admin-role-refresh");
  let target = null, epoch = 0, pending = false, submission = null, actorUid = null;
  const current = generation => generation === epoch && getUser()?.uid === actorUid && getUser()?.role === "admin";
  const setPending = value => {
    pending = value;
    for (const element of [save, cancel, email, reason, refresh]) element.disabled = value;
    save.textContent = value ? "Salvando…" : target?.role === "admin" ? "Remover ADMIN" : "Tornar ADMIN";
    form.setAttribute("aria-busy", String(value));
  };
  const showError = (message, conflict = false) => {
    error.textContent = message;
    error.hidden = false;
    refresh.hidden = !conflict;
  };
  const describe = () => {
    $("#admin-role-title").textContent = target.role === "admin" ? "Remover permissão de ADMIN?" : "Tornar esta pessoa ADMIN?";
    $("#admin-role-person").textContent = `${target.name} · ${target.email}`;
    $("#admin-role-confirm-email").textContent = target.email;
    $("#admin-role-description").textContent = target.role === "admin"
      ? "Esta pessoa perderá o acesso administrativo. O acesso aprovado ao sistema e seu perfil de colaborador, gestor ou RH serão preservados."
      : "Esta pessoa terá acesso amplo à administração, aos dados da equipe e à concessão ou remoção de ADMIN de outras contas. A alteração será registrada no histórico.";
    setPending(false);
  };
  const clearSubmission = () => { submission = null; error.hidden = true; refresh.hidden = true; };
  email.oninput = reason.oninput = clearSubmission;
  cancel.onclick = () => { if (!pending) { target = null; epoch++; dialog.close(); } };
  dialog.oncancel = event => { if (pending) event.preventDefault(); else { target = null; epoch++; } };
  refresh.onclick = async () => {
    if (!target || pending) return;
    const generation = epoch, uid = target.uid;
    let unavailable = false;
    setPending(true);
    try {
      const response = await api("admin-users", {query: `&q=${encodeURIComponent(target.email)}`});
      if (!current(generation)) return;
      const user = response.users.find(person => person.uid === uid);
      if (!user || user.status !== "active" || !user.canChangeRole || user.uid === actorUid) {
        unavailable = true;
        target = null;
        showError("Esta conta não está mais disponível para alterar a permissão. Feche e atualize a lista de funcionários.");
        return;
      }
      target = {...user};
      submission = null;
      describe();
      showError("Dados atualizados. Confira a permissão e confirme novamente antes de salvar.");
    } catch (failure) {
      if (current(generation)) showError(failure.message, true);
    } finally {
      if (current(generation)) {
        setPending(false);
        if (unavailable) save.disabled = true;
      }
    }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    if (!target || pending || !current(epoch)) return;
    error.hidden = true;
    if (email.value !== target.email) return showError("Digite exatamente o e-mail da conta para confirmar.");
    const explanation = reason.value.trim();
    if (explanation.length < 10 || explanation.length > 1000) return showError("Informe uma justificativa entre 10 e 1.000 caracteres.");
    const body = {uid: target.uid, role: target.role === "admin" ? "employee" : "admin", version: target.version, roleVersion: target.adminRoleVersion, confirmationEmail: email.value, reason: explanation};
    const signature = JSON.stringify(body);
    if (!submission || submission.signature !== signature) submission = {signature, requestId: crypto.randomUUID()};
    const data = {...body, requestId: submission.requestId}, generation = epoch;
    setPending(true);
    try {
      const result = await api("admin-role", {method: "POST", data});
      if (!current(generation)) return;
      target = null;
      dialog.close();
      toast(result.user.role === "admin" ? "Permissão de ADMIN concedida com histórico." : "Permissão de ADMIN removida com histórico.");
      await onChanged(result.user);
    } catch (failure) {
      if (current(generation)) showError(failure.message, failure.status === 409);
    } finally {
      if (current(generation)) setPending(false);
    }
  };
  return {
    open(person) {
      const actor = getUser();
      if (!person || person.status !== "active" || person.canChangeRole !== true || person.uid === actor?.uid || actor?.role !== "admin" || pending) return;
      epoch++;
      actorUid = actor.uid;
      target = {...person};
      submission = null;
      form.reset();
      error.hidden = refresh.hidden = true;
      describe();
      dialog.showModal();
      email.focus();
    },
    reset() {
      epoch++;
      target = submission = actorUid = null;
      setPending(false);
      form.reset();
      error.hidden = refresh.hidden = true;
      dialog.close();
    }
  };
}
