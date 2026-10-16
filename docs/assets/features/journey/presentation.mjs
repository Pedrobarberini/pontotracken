import { escapeHTML as esc } from "../../shared/dom.mjs?v=admin-overtime-top-1";
import { formatInstant } from "../../shared/formatters.mjs?v=admin-overtime-top-1";
function createOvertimePresentation({ hours, getUser, statusNames }) {
  const when = (value) => formatInstant(value, "short");
  const legacy = (row) => row.requested_work == null;
  const approverLabel = (row) => row.approver_uid ? row.approver_name || row.approver_email || "ADMIN designado" : "Não definido no registro anterior.";
  function details(row) {
    const missing = "Não informado no registro anterior.";
    return `${legacy(row) ? '<p><span class="status pending">Registro anterior</span></p>' : ""}<dl class="overtime-details">
      <dt>Quem solicitou</dt><dd>${esc(row.requested_by || missing)}</dd>
      <dt>Responsável pela aprovação</dt><dd>${esc(approverLabel(row))}${row.approver_email ? ` <span class="field-hint">${esc(row.approver_email)}</span>` : ""}</dd>
      <dt>O que foi solicitado</dt><dd>${esc(row.requested_work || missing)}</dd>
      <dt>O que foi realizado</dt><dd>${esc(row.performed_work || (legacy(row) ? missing : row.status === "running" ? "Será informado ao encerrar o cronômetro." : "Não informado."))}</dd>
      <dt>Por que foi fora do horário</dt><dd>${esc(row.reason || missing)}</dd>
    </dl>`;
  }
  function occurrence(row, admin = false) {
    let actions = "";
    if (!admin && row.can_reassign === true) actions += `<button class="button secondary small" data-assign-id="${esc(row.id)}">Trocar responsável</button>`;
    if (admin && row.can_review === true) actions += `<button class="button secondary small" data-review-id="${esc(row.id)}">Analisar</button>`;
    else if (admin && row.status === "pending") actions += `<p class="field-hint">${row.uid === getUser()?.uid ? "Sua ocorrência precisa da análise de outro ADMIN." : row.approver_uid ? "Análise reservada ao responsável designado." : "A análise depende de outro ADMIN disponível."}</p>`;
    return `<article class="overtime-item"><div class="overtime-item-heading"><strong>${admin ? esc(row.name) + " · " : ""}${esc(when(row.start_at))}${row.end_at ? " até " + esc(when(row.end_at)) : " em andamento"}</strong><span class="status ${row.status === "pending" ? "pending" : row.status === "rejected" ? "blocked" : ""}">${statusNames[row.status]}</span></div>${details(row)}<p class="field-hint">Duração ${hours(row.minutes)}</p>${row.review_reason ? `<p><strong>Justificativa da decisão</strong><br>${esc(row.review_reason)}</p>${row.reviewed_at ? `<p class="field-hint">Analisada em ${esc(when(row.reviewed_at))}</p>` : ""}` : ""}${actions}</article>`;
  }
  return { occurrence, details, approverLabel };
}
export {
  createOvertimePresentation
};
