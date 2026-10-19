import { escapeHTML as esc } from "../../shared/dom.mjs?v=account-management-1";

export const accountLabels = {
  pending: "Aguardando aprovação", active: "Liberado", blocked: "Bloqueado", deleted: "Conta excluída"
};

/** Returns plain text; the history view escapes each value when rendering. */
export function accountEventDetails(event) {
  if (event.action === "account:delete") return {
    title: "EXCLUSÃO DE CONTA",
    before: accountLabels[event.before?.status] || "Conta anterior",
    after: accountLabels[event.after?.status] || "Conta excluída"
  };
  if (event.action !== "account:points-transfer") return null;
  const source = event.before?.source?.email || event.after?.sourceUid || "Conta de origem";
  const target = event.before?.target?.email || event.after?.targetUid || "Conta de destino";
  const counts = event.after?.counts || {};
  const count = name => Number.isInteger(counts[name]) && counts[name] >= 0 ? counts[name] : 0;
  return {
    title: "TRANSFERÊNCIA DE PONTOS",
    before: `${source} → ${target}`,
    after: `Transferidos para ${target}: ${count("days")} dias de ponto, ${count("schedules")} registros de escala e ${count("overtime")} ocorrências de horas extras.`
  };
}

export function accountActions(person) {
  const history = `<button class="text-button" data-records-uid="${esc(person.uid)}">Ver ponto</button>`;
  if (person.status === "deleted") return `${history}<span class="field-hint">Histórico preservado</span>`;
  if (person.role === "admin") return `${history}<span class="field-hint">Acesso protegido</span>`;
  const active = person.status === "active";
  return `${history}<button class="button ${active ? "secondary" : "primary"} small" data-access-uid="${esc(person.uid)}" data-status="${active ? "blocked" : "active"}">${active ? "Bloquear" : person.status === "blocked" ? "Reativar" : "Aprovar"}</button><button type="button" class="text-button admin-delete-action" data-delete-account-uid="${esc(person.uid)}">Excluir conta</button>`;
}
