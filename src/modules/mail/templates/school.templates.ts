import {
  e,
  highlightBox,
  mailButton,
  mailLayout,
  muted,
  paragraph,
  type RenderedEmail,
} from './layout';

export function schoolSubmittedForReview(props: {
  ownerName: string;
  schoolName: string;
}): RenderedEmail {
  const subject = 'Perfil submetido para análise';
  const text = `Olá ${props.ownerName},\n\nO colégio "${props.schoolName}" foi submetido para análise.\n— Ekanda`;
  const html = mailLayout({
    preview: 'Perfil do colégio em análise',
    title: 'Perfil submetido',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('O perfil de <strong>' + e(props.schoolName) + '</strong> foi submetido para análise pela equipa Ekanda.')}
      ${highlightBox('Avisaremos por email assim que o perfil for aprovado ou se precisarmos de ajustes.')}
    `,
  });
  return { subject, html, text };
}

export function schoolPendingReviewOps(props: {
  schoolName: string;
  ownerEmail: string;
  adminUrl: string;
}): RenderedEmail {
  const subject = `[Ops] Novo colégio: ${props.schoolName}`;
  const text = `Novo colégio "${props.schoolName}" (${props.ownerEmail}) aguarda aprovação.\n${props.adminUrl}`;
  const html = mailLayout({
    preview: `Novo colégio: ${props.schoolName}`,
    title: 'Novo colégio na fila',
    bodyHtml: `
      ${paragraph('<strong>Colégio:</strong> ' + e(props.schoolName))}
      ${paragraph('<strong>Responsável:</strong> ' + e(props.ownerEmail))}
      ${mailButton(props.adminUrl, 'Abrir no painel')}
    `,
    footerNote: 'Alerta interno Ekanda — painel de operações.',
  });
  return { subject, html, text };
}

export function schoolApproved(props: {
  ownerName: string;
  schoolName: string;
  marketplaceUrl: string;
}): RenderedEmail {
  const subject = 'Colégio publicado no marketplace';
  const text = `Olá ${props.ownerName},\n\n"${props.schoolName}" foi aprovado.\n${props.marketplaceUrl}\n— Ekanda`;
  const html = mailLayout({
    preview: 'O colégio está visível no marketplace',
    title: 'Colégio aprovado',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('<strong>' + e(props.schoolName) + '</strong> foi aprovado e está visível no marketplace Ekanda.')}
      ${mailButton(props.marketplaceUrl, 'Ver página pública')}
    `,
  });
  return { subject, html, text };
}

export function schoolRejected(props: {
  ownerName: string;
  schoolName: string;
  reason: string;
  dashboardUrl: string;
}): RenderedEmail {
  const subject = 'Actualização sobre o cadastro do colégio';
  const text = `Olá ${props.ownerName},\n\n"${props.schoolName}" não foi aprovado.\nMotivo: ${props.reason}\n— Ekanda`;
  const html = mailLayout({
    preview: 'Actualização sobre cadastro do colégio',
    title: 'Cadastro não aprovado',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('O cadastro de <strong>' + e(props.schoolName) + '</strong> não foi aprovado nesta análise.')}
      ${highlightBox('<strong>Motivo:</strong><br/>' + e(props.reason))}
      ${mailButton(props.dashboardUrl, 'Ajustar perfil')}
    `,
  });
  return { subject, html, text };
}

export function schoolStatusChanged(props: {
  ownerName: string;
  schoolName: string;
  statusLabel: string;
  reason?: string | null;
  dashboardUrl: string;
}): RenderedEmail {
  const subject = `Estado do colégio: ${props.statusLabel}`;
  const text = `Olá ${props.ownerName},\n\n"${props.schoolName}" — ${props.statusLabel}\n— Ekanda`;
  const html = mailLayout({
    preview: `Estado actualizado: ${props.statusLabel}`,
    title: 'Estado actualizado',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('O estado de <strong>' + e(props.schoolName) + '</strong> foi actualizado para <strong>' + e(props.statusLabel) + '</strong>.')}
      ${props.reason ? highlightBox(e(props.reason)) : ''}
      ${mailButton(props.dashboardUrl, 'Abrir painel')}
    `,
  });
  return { subject, html, text };
}

export function schoolLegalApproved(props: {
  ownerName: string;
  schoolName: string;
  juridicoUrl: string;
}): RenderedEmail {
  const subject = 'Cadastro aprovado — consulte a área Jurídica';
  const text = `Olá ${props.ownerName},\n\nO colégio "${props.schoolName}" foi aprovado. Consulte a validação fiscal (NIF) na área Jurídica:\n${props.juridicoUrl}\n— Ekanda`;
  const html = mailLayout({
    preview: 'Cadastro aprovado — validação fiscal',
    title: 'Cadastro aprovado',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('O perfil de <strong>' + e(props.schoolName) + '</strong> foi aprovado pela equipa Ekanda.')}
      ${paragraph('Consulte ou submeta o NIF da instituição na área Jurídica do painel do colégio.')}
      ${mailButton(props.juridicoUrl, 'Abrir área Jurídica')}
    `,
  });
  return { subject, html, text };
}

export function schoolNifSubmittedOps(props: {
  schoolName: string;
  nif: string;
  ownerEmail: string;
  adminUrl: string;
}): RenderedEmail {
  const subject = `[Ops] NIF submetido: ${props.schoolName}`;
  const text = `Colégio "${props.schoolName}" submeteu NIF ${props.nif} (${props.ownerEmail}).\n${props.adminUrl}`;
  const html = mailLayout({
    preview: `NIF submetido — ${props.schoolName}`,
    title: 'NIF aguarda validação',
    bodyHtml: `
      ${paragraph('<strong>Colégio:</strong> ' + e(props.schoolName))}
      ${paragraph('<strong>NIF:</strong> ' + e(props.nif))}
      ${paragraph('<strong>Responsável:</strong> ' + e(props.ownerEmail))}
      ${highlightBox('Valide o NIF no portal da AGT e confirme na área Jurídica do painel admin.')}
      ${mailButton(props.adminUrl, 'Validar NIF no admin')}
    `,
    footerNote: 'Alerta interno Ekanda — validação fiscal.',
  });
  return { subject, html, text };
}

export function schoolNifVerified(props: {
  ownerName: string;
  schoolName: string;
  nif: string;
  juridicoUrl: string;
}): RenderedEmail {
  const subject = 'NIF validado — área Jurídica';
  const text = `Olá ${props.ownerName},\n\nO NIF ${props.nif} de "${props.schoolName}" foi validado pela equipa Ekanda.\n${props.juridicoUrl}\n— Ekanda`;
  const html = mailLayout({
    preview: 'NIF validado com sucesso',
    title: 'Validação fiscal concluída',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('A equipa Ekanda validou o NIF de <strong>' + e(props.schoolName) + '</strong>.')}
      ${highlightBox('<strong>NIF:</strong> ' + e(props.nif))}
      ${paragraph('Pode consultar o estado na área Jurídica do painel.')}
      ${mailButton(props.juridicoUrl, 'Abrir área Jurídica')}
    `,
  });
  return { subject, html, text };
}

export function schoolNifRejected(props: {
  ownerName: string;
  schoolName: string;
  reason: string;
  juridicoUrl: string;
}): RenderedEmail {
  const subject = 'NIF não validado — acção necessária';
  const text = `Olá ${props.ownerName},\n\nO NIF de "${props.schoolName}" não foi validado.\nMotivo: ${props.reason}\n${props.juridicoUrl}\n— Ekanda`;
  const html = mailLayout({
    preview: 'NIF não validado',
    title: 'Validação fiscal recusada',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('A validação do NIF de <strong>' + e(props.schoolName) + '</strong> não foi aceite.')}
      ${highlightBox('<strong>Motivo:</strong><br/>' + e(props.reason))}
      ${paragraph('Corrija e submeta novamente na área Jurídica.')}
      ${mailButton(props.juridicoUrl, 'Abrir área Jurídica')}
    `,
  });
  return { subject, html, text };
}

export function schoolNifDeadlineReminder(props: {
  ownerName: string;
  schoolName: string;
  daysRemaining: number;
  deadlineLabel: string;
  juridicoUrl: string;
}): RenderedEmail {
  const subject = `Prazo NIF — faltam ${props.daysRemaining} dias`;
  const text = `Olá ${props.ownerName},\n\nSubmeta o NIF de "${props.schoolName}" até ${props.deadlineLabel}. Caso contrário, o colégio será suspenso.\n${props.juridicoUrl}\n— Ekanda`;
  const html = mailLayout({
    preview: `Faltam ${props.daysRemaining} dias para submeter o NIF`,
    title: 'Prazo para submissão do NIF',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('O colégio <strong>' + e(props.schoolName) + '</strong> ainda não submeteu o NIF na área Jurídica.')}
      ${highlightBox(
        'Faltam <strong>' +
          e(String(props.daysRemaining)) +
          ' dias</strong> (até ' +
          e(props.deadlineLabel) +
          '). Sem submissão, o colégio será <strong>suspenso</strong> e deixará de estar visível no marketplace.',
      )}
      ${mailButton(props.juridicoUrl, 'Submeter NIF agora')}
    `,
  });
  return { subject, html, text };
}
