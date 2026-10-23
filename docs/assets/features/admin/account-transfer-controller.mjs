import { $ } from "../../shared/dom.mjs?v=admin-roles-1";

/** Transfers are verified on the server before any ownership change is offered. */
export function createAccountTransfer({ api, getUser }) {
  const dialog = $("#admin-transfer-dialog"), form = $("#admin-transfer-form");
  const sourceEmail = $("#admin-transfer-source-email"), targetEmail = $("#admin-transfer-target-email");
  const sourceConfirmation = $("#admin-transfer-confirm-source"), targetConfirmation = $("#admin-transfer-confirm-target");
  const reason = $("#admin-transfer-reason"), verify = $("#admin-transfer-verify"), save = $("#admin-transfer-save");
  const close = $("#admin-transfer-close"), summary = $("#admin-transfer-summary"), error = $("#admin-transfer-error");
  const confirmation = $("#admin-transfer-confirmation"), fields = $("#admin-transfer-accounts");
  let epoch = 0, checking = false, preview = null, completed = false, operation = null;
  const showError = message => { error.textContent = message; error.hidden = false; };
  function pending(value) {
    checking = value;
    for (const element of [sourceEmail, targetEmail, sourceConfirmation, targetConfirmation, reason, verify, save, close]) element.disabled = value;
    form.setAttribute("aria-busy", String(value));
  }
  function invalidate() {
    epoch++;
    preview = operation = null;
    confirmation.hidden = save.hidden = true;
    summary.textContent = "";
    error.hidden = true;
  }
  sourceEmail.oninput = targetEmail.oninput = invalidate;
  sourceConfirmation.oninput = targetConfirmation.oninput = reason.oninput = () => { operation = null; error.hidden = true; };
  async function exactAccount(email) {
    const result = await api("admin-users", {query: `&q=${encodeURIComponent(email)}`});
    const matches = result.users.filter(user => user.email.toLowerCase() === email.toLowerCase());
    if (matches.length !== 1) throw new Error(`A conta ${email} não foi encontrada. Ela precisa estar cadastrada no sistema.`);
    return matches[0];
  }
  verify.onclick = async () => {
    if (checking || completed) return;
    invalidate();
    const from = sourceEmail.value.trim(), to = targetEmail.value.trim();
    if (!from || !to || !sourceEmail.checkValidity() || !targetEmail.checkValidity()) return showError("Informe os e-mails válidos de origem e destino.");
    if (from.toLowerCase() === to.toLowerCase()) return showError("Escolha contas diferentes para a transferência.");
    const generation = epoch;
    pending(true);
    summary.textContent = "Conferindo contas e registros…";
    try {
      const [source, target] = await Promise.all([exactAccount(from), exactAccount(to)]);
      if (generation !== epoch) return;
      const result = await api("admin-account-transfer-preview", {query:`&sourceUid=${encodeURIComponent(source.uid)}&targetUid=${encodeURIComponent(target.uid)}`});
      if (generation !== epoch) return;
      if (!result.canTransfer) {
        summary.textContent = "Não é possível transferir estes registros.";
        showError((result.issues || []).map(issue => typeof issue === "string" ? issue : issue.message || issue.code || "Confira os dados das contas.").join(" ") || "Confira as contas e os registros antes de continuar.");
        return;
      }
      preview = result;
      const counts = result.counts;
      summary.textContent = `${result.source.email} → ${result.target.email}. Serão transferidos ${counts.days} dias de ponto, ${counts.schedules} registros de escala e ${counts.overtime} ocorrências de horas extras.`;
      $("#admin-transfer-source-label").textContent = result.source.email;
      $("#admin-transfer-target-label").textContent = result.target.email;
      confirmation.hidden = save.hidden = false;
      sourceConfirmation.focus();
    } catch (failure) {
      if (generation === epoch) { summary.textContent = ""; showError(failure.message); }
    } finally {
      if (generation === epoch) pending(false);
    }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    if (!preview || checking || completed) return;
    error.hidden = true;
    if (sourceConfirmation.value !== preview.source.email || targetConfirmation.value !== preview.target.email) return showError("Digite exatamente os dois e-mails conferidos para confirmar.");
    const explanation = reason.value.trim();
    if (explanation.length < 10 || explanation.length > 1000) return showError("Informe uma justificativa entre 10 e 1.000 caracteres.");
    const body = {sourceUid:preview.source.uid, targetUid:preview.target.uid, confirmationSourceEmail:sourceConfirmation.value, confirmationTargetEmail:targetConfirmation.value, previewFingerprint:preview.fingerprint, reason:explanation};
    const signature = JSON.stringify(body);
    if (!operation || operation.signature !== signature) operation = {signature, requestId:crypto.randomUUID()};
    const generation = epoch;
    pending(true);
    save.textContent = "Transferindo…";
    try {
      await api("admin-account-transfer", {method:"POST",data:{...body,requestId:operation.requestId}});
      if (generation !== epoch) return;
      completed = true;
      confirmation.hidden = save.hidden = verify.hidden = true;
      fields.hidden = true;
      summary.textContent = "Transferência concluída. Os pontos, escalas e ocorrências de horas extras agora pertencem à conta de destino. As sessões das duas contas foram encerradas. Entre novamente para consultar os registros atualizados.";
      close.textContent = "Concluir e entrar novamente";
      close.focus();
    } catch (failure) {
      if (generation === epoch) showError(failure.message);
    } finally {
      if (generation === epoch) { pending(false); save.textContent = "Confirmar transferência"; }
    }
  };
  close.onclick = () => {
    if (checking) return;
    epoch++;
    dialog.close();
    if (completed) $("#logout").click();
  };
  dialog.oncancel = event => {
    if (checking || completed) event.preventDefault();
    else epoch++;
  };
  $("#admin-open-transfer").onclick = () => {
    epoch++;
    form.reset();
    pending(false);
    preview = operation = null;
    completed = false;
    error.hidden = confirmation.hidden = save.hidden = true;
    fields.hidden = verify.hidden = Boolean(getUser()?.demo);
    close.textContent = "Cancelar";
    summary.textContent = getUser()?.demo ? "A transferência de pontos está disponível para contas cadastradas no ambiente real. Os dados fictícios desta demonstração são independentes das contas da empresa." : "Confira as contas para visualizar a quantidade de registros antes de confirmar.";
    dialog.showModal();
    if (!getUser()?.demo) sourceEmail.focus();
  };
  return { reset() { epoch++; preview = operation = null; completed = false; pending(false); dialog.close(); } };
}
