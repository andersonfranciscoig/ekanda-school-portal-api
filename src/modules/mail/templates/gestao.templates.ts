import {
  e,
  highlightBox,
  mailButton,
  mailLayout,
  muted,
  paragraph,
  type RenderedEmail,
} from './layout';

export function gestaoWaitlistReceived(props: {
  ownerName: string;
  schoolName: string;
}): RenderedEmail {
  const subject = 'Pedido de acesso ao módulo Gestão';
  const text = `Olá ${props.ownerName},\n\nPedido registado para ${props.schoolName}.\n— Ekanda`;
  const html = mailLayout({
    preview: 'Pedido módulo Gestão registado',
    title: 'Pedido registado',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('Recebemos o pedido de acesso ao <strong>módulo Gestão</strong> para <strong>' + e(props.schoolName) + '</strong>.')}
      ${muted('Avisaremos por email quando o acesso for aprovado.')}
    `,
  });
  return { subject, html, text };
}

export function gestaoWaitlistApproved(props: {
  ownerName: string;
  schoolName: string;
  testUrl: string | null;
}): RenderedEmail {
  const subject = 'Acesso ao módulo Gestão aprovado';
  const text = `Olá ${props.ownerName},\n\nAcesso Gestão aprovado — ${props.schoolName}.\n— Ekanda`;
  const html = mailLayout({
    preview: 'Módulo Gestão aprovado',
    title: 'Acesso aprovado',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('O acesso ao <strong>módulo Gestão</strong> para <strong>' + e(props.schoolName) + '</strong> foi aprovado.')}
      ${props.testUrl ? mailButton(props.testUrl, 'Abrir ambiente de teste') : highlightBox('Consulte o painel Ekanda para o link de acesso.')}
    `,
  });
  return { subject, html, text };
}

export function gestaoWaitlistRejected(props: {
  ownerName: string;
  schoolName: string;
  adminNote?: string | null;
}): RenderedEmail {
  const subject = 'Actualização — módulo Gestão';
  const note = props.adminNote?.trim();
  const text = `Olá ${props.ownerName},\n\nPedido Gestão não aprovado — ${props.schoolName}.\n— Ekanda`;
  const html = mailLayout({
    preview: 'Actualização módulo Gestão',
    title: 'Pedido não aprovado',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('O pedido de acesso ao módulo Gestão para <strong>' + e(props.schoolName) + '</strong> não foi aprovado.')}
      ${note ? highlightBox(e(note)) : ''}
    `,
  });
  return { subject, html, text };
}
