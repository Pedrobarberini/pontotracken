import { escapeHTML as e, icon } from '../../shared/dom.mjs?v=account-management-1';

export const eventTypes = {
  orientation: 'Orientação', feedback: 'Feedback', improvement: 'Melhoria',
  conversation: 'Conversa', training: 'Treinamento', warning: 'Advertência',
  medical: 'Atestado', movement: 'Movimentação', milestone: 'Marco'
};
export const documentCategories = { identity: 'Identificação', contract: 'Contrato', certificate: 'Certificado', medical: 'Saúde', proof: 'Comprovante', other: 'Outro' };
export const roleNames = { employee: 'Colaborador', manager: 'Gestor', hr: 'RH', admin: 'ADMIN' };
export const workModes = { '': 'Não informado', remote: 'Remoto', hybrid: 'Híbrido', onsite: 'Presencial' };
export const initials = name => String(name || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
export const dateLabel = value => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value)) : 'Não informado';
export const options = (values, current = '') => Object.entries(values).map(([value, label]) => `<option value="${e(value)}" ${value === current ? 'selected' : ''}>${e(label)}</option>`).join('');
export const completion = profile => {
  const fields = ['employeeNumber', 'jobTitle', 'department', 'hireDate', 'workMode', 'location'];
  const missing = fields.filter(field => !profile[field]);
  return { percentage: Math.round((fields.length - missing.length) / fields.length * 100), missing };
};
export const badge = (label, style = '') => `<span class="status ${e(style)}">${e(label)}</span>`;
export function acknowledgementBadge(row) {
  if (row.acknowledgementStatus === 'confirmed') return badge(`Ciência no app em ${dateLabel(row.acknowledgedAt)}`);
  if (row.acknowledgementStatus === 'attached') return badge('Comprovante anexado', 'existing');
  if (row.acknowledgementMode === 'proof') return badge('Comprovante pendente', 'pending');
  if (row.acknowledgementRequired) return badge('Aguardando ciência no app', 'pending');
  return badge(row.acknowledgementMode === 'proof' ? 'Comprovante pendente' : 'Sem ciência no app solicitada', 'existing');
}
export function personCard(profile) {
  const progress = completion(profile);
  return `<div class="people-profile"><span class="people-avatar large">${e(initials(profile.name))}</span><div class="people-identity"><h2>${e(profile.name)}</h2><p>${e(profile.email)}</p><div class="people-facts"><span>${e(profile.jobTitle || 'Cargo não informado')}</span><span>${e(profile.department || 'Área não informada')}</span><span>Gestor: ${e(profile.managerName || 'Não definido')}</span><span>Admissão: ${dateLabel(profile.hireDate)}</span></div></div><div class="people-completion"><strong>Cadastro ${progress.percentage}% completo</strong><progress max="100" value="${progress.percentage}" aria-label="Cadastro profissional completo"></progress><span>${progress.missing.length ? `${progress.missing.length} campos profissionais pendentes` : 'Dados profissionais em dia'}</span></div></div>`;
}
export function peopleTable(people) {
  if (!people.length) return '<div class="empty-state">Nenhum colaborador encontrado. Ajuste os filtros.</div>';
  return `<div class="table-scroll"><table class="records-table people-table"><thead><tr><th>Colaborador</th><th>Cargo e área</th><th>Admissão</th><th>Cadastro</th><th>Perfil</th><th></th></tr></thead><tbody>${people.map(person => `<tr><td><div class="people-person"><span class="people-avatar">${e(initials(person.name))}</span><div><strong>${e(person.name)}</strong><small>${e(person.email)}</small></div></div></td><td>${e(person.jobTitle || 'Não informado')}<small>${e(person.department || 'Área não informada')}</small></td><td>${dateLabel(person.hireDate)}</td><td><progress max="100" value="${completion(person).percentage}" aria-label="Cadastro de ${e(person.name)}"></progress><small>${completion(person).percentage}% completo</small></td><td>${badge(roleNames[person.role] || 'Colaborador', 'existing')}</td><td><button class="button secondary small" data-person="${e(person.uid)}">Abrir ficha</button></td></tr>`).join('')}</tbody></table></div>`;
}
export function documentState(document, today) {
  if (document.status === 'archived') return { label: 'Arquivado', style: 'existing' };
  if (!document.expiresOn) return { label: 'Sem vencimento', style: 'existing' };
  const days = Math.round((new Date(document.expiresOn + 'T12:00:00Z') - new Date(today + 'T12:00:00Z')) / 86400000);
  return days < 0 ? { label: 'Vencido', style: 'blocked' } : days <= 30 ? { label: days === 0 ? 'Vence hoje' : `Vence em ${days} dias`, style: 'pending' } : { label: 'Em dia', style: '' };
}
export function documentLink(document) {
  return `<button class="people-file" data-file="${e(document.id)}">${icon('file')}<span>${e(document.title || document.filename)}</span><small>${(document.bytes / 1024).toFixed(0)} KB</small>${icon('download')}</button>`;
}
export function timeline(rows, { isSelf, canCreateEvent, canReadRestricted = false, actorUid, today }) {
  if (!rows.length) return '<div class="empty-state">Nenhum registro neste filtro.</div>';
  return `<ol class="people-timeline">${rows.map(row => `<li data-people-item="${e(row.id)}" tabindex="-1"><time datetime="${e(row.occurredOn)}">${dateLabel(row.occurredOn)}</time><span class="people-timeline-marker">${icon(row.type === 'medical' ? 'file' : 'check')}</span><article><header><div class="people-row">${badge(eventTypes[row.type] || row.type, 'existing')}${row.visibility === 'hr' ? badge('Restrito ao RH', 'medical') : ''}${row.status === 'archived' ? badge('Arquivado', 'existing') : ''}</div><h3>${e(row.title)}</h3></header><p class="people-event-content">${e(row.content)}</p>${row.documents?.length ? `<div class="people-files">${row.documents.map(documentLink).join('')}</div>` : ''}<div class="people-meta"><span>Registrado por ${e(row.createdByName || 'Responsável')} · ${dateLabel(row.createdAt)}</span>${acknowledgementBadge(row)}</div>${row.archiveReason ? `<p class="field-hint">Motivo do arquivamento: ${e(row.archiveReason)}</p>` : ''}<div class="people-actions"><button class="button secondary small" data-event-term="${e(row.id)}" title="Baixar modelo em PDF para impressão; não registra ciência ou assinatura.">${icon('file')}Gerar termo</button>${isSelf && row.status === 'active' && row.acknowledgementMode === 'app' && row.acknowledgementStatus !== 'confirmed' ? `<button class="button primary small" data-ack="${e(row.id)}">Confirmar ciência</button>` : ''}${row.status === 'active' && (canCreateEvent || isSelf && row.acknowledgementMode === 'proof') ? `<button class="button secondary small" data-proof="${e(row.id)}">Anexar comprovante</button>` : ''}${canCreateEvent && row.status === 'active' && (canReadRestricted || row.createdBy === actorUid) ? `<button class="text-button" data-archive-event="${e(row.id)}">Arquivar</button>` : ''}</div></article></li>`).join('')}</ol>`;
}
export function documentTable(rows, { canUpload, canCreateEvent = false, actorUid, today }) {
  if (!rows.length) return '<div class="empty-state">Nenhum documento neste filtro.</div>';
  return `<div class="table-scroll"><table class="records-table people-table"><thead><tr><th>Documento</th><th>Situação</th><th>Validade</th><th>Visibilidade</th><th></th></tr></thead><tbody>${rows.map(document => { const status = documentState(document, today); return `<tr data-people-item="${e(document.id)}" tabindex="-1"><td>${documentLink(document)}<small>${e(documentCategories[document.category] || document.category)} · ${e(document.filename)}</small></td><td>${badge(status.label, status.style)}</td><td>${document.expiresOn ? dateLabel(document.expiresOn) : '—'}<small>Emissão: ${document.issuedOn ? dateLabel(document.issuedOn) : '—'}</small></td><td>${badge(document.visibility === 'hr' ? 'Restrito ao RH' : 'Compartilhado', document.visibility === 'hr' ? 'medical' : 'existing')}</td><td>${canUpload && document.status === 'active' && (canCreateEvent || document.uploadedBy === actorUid) ? `<button class="text-button" data-archive-document="${e(document.id)}">Arquivar</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
}
