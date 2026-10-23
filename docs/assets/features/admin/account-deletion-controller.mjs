import { $ } from "../../shared/dom.mjs?v=admin-roles-1";

/** The operation is permanent in the app; previous records remain available to administrators. */
export function createAccountDeletion({ api, toast, onDeleted }) {
  const dialog = $("#admin-delete-dialog"), form = $("#admin-delete-form");
  const email = $("#admin-delete-email"), reason = $("#admin-delete-reason");
  const save = $("#admin-delete-save"), cancel = $("#admin-delete-cancel"), error = $("#admin-delete-error");
  let target = null, epoch = 0, pending = false, submission = null;
  const setPending = value => {
    pending = value;
    for (const element of [save, cancel, email, reason]) element.disabled = value;
    save.textContent = value ? "Excluindo…" : "Excluir conta";
    form.setAttribute("aria-busy", String(value));
  };
  const showError = message => { error.textContent = message; error.hidden = false; };
  const clearSubmission = () => { submission = null; error.hidden = true; };
  email.oninput = reason.oninput = clearSubmission;
  cancel.onclick = () => { if (!pending) { target = null; epoch++; dialog.close(); } };
  dialog.oncancel = event => { if (pending) event.preventDefault(); else { target = null; epoch++; } };
  form.onsubmit = async event => {
    event.preventDefault();
    if (!target || pending) return;
    error.hidden = true;
    if (email.value !== target.email) return showError("Digite exatamente o e-mail da conta para confirmar.");
    const explanation = reason.value.trim();
    if (explanation.length < 10 || explanation.length > 1000) return showError("Informe uma justificativa entre 10 e 1.000 caracteres.");
    const body = { uid: target.uid, version: target.version, confirmationEmail: email.value, reason: explanation };
    const signature = JSON.stringify(body);
    if (!submission || submission.signature !== signature) submission = { signature, requestId: crypto.randomUUID() };
    const data = { ...body, requestId: submission.requestId }, generation = epoch;
    setPending(true);
    try {
      const result = await api("admin-account-delete", { method: "POST", data });
      if (generation !== epoch) return;
      target = null;
      dialog.close();
      toast("Conta excluída. O acesso foi encerrado e o histórico foi preservado.");
      await onDeleted(result.user);
    } catch (failure) {
      if (generation === epoch) showError(failure.message);
    } finally {
      if (generation === epoch) setPending(false);
    }
  };
  return {
    open(person) {
      if (!person || person.role === "admin" || person.status === "deleted" || pending) return;
      epoch++;
      target = { uid: person.uid, email: person.email, version: person.version };
      submission = null;
      form.reset();
      error.hidden = true;
      $("#admin-delete-person").textContent = `${person.name} · ${person.email}`;
      $("#admin-delete-confirm-email").textContent = person.email;
      setPending(false);
      dialog.showModal();
      email.focus();
    },
    reset() {
      epoch++;
      target = submission = null;
      setPending(false);
      form.reset();
      error.hidden = true;
      dialog.close();
    }
  };
}
