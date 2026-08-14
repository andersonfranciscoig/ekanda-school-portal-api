import {
  e,
  highlightBox,
  mailButton,
  mailLayout,
  muted,
  paragraph,
  type RenderedEmail,
} from './layout';

export function betaRequestReceived(props: {
  firstName: string;
  testerTypeLabel: string;
}): RenderedEmail {
  const subject = 'Recebemos o seu pedido de acesso';
  const text = `Olá ${props.firstName},\n\nPedido registado (${props.testerTypeLabel}). Avisaremos quando for analisado.\n— Ekanda`;
  const html = mailLayout({
    preview: 'Pedido de acesso beta registado',
    title: 'Pedido na fila',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.firstName)}</strong>,`)}
      ${paragraph('Recebemos o seu pedido para testar a Ekanda como <strong>' + e(props.testerTypeLabel) + '</strong>.')}
      ${highlightBox('A nossa equipa irá analisar o pedido. Receberá outro email quando houver uma decisão.')}
      ${muted('Entretanto, pode fechar esta página — não precisa de fazer mais nada.')}
    `,
  });
  return { subject, html, text };
}

export function betaApproved(props: {
  firstName: string;
  testerTypeLabel: string;
  comunidadeUrl: string;
}): RenderedEmail {
  const subject = 'Acesso aprovado — crie a sua conta';
  const text = `Olá ${props.firstName},\n\nAcesso aprovado (${props.testerTypeLabel}). Crie conta: ${props.comunidadeUrl}\n— Ekanda`;
  const html = mailLayout({
    preview: 'Pode criar a sua conta Ekanda',
    title: 'Acesso aprovado',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.firstName)}</strong>,`)}
      ${paragraph('Boas notícias — o seu pedido foi <strong>aprovado</strong> para testar como <strong>' + e(props.testerTypeLabel) + '</strong>.')}
      ${paragraph('Volte à comunidade, escolha «Já faço parte» e confirme os mesmos dados. Depois crie a sua conta.')}
      ${mailButton(props.comunidadeUrl, 'Continuar em /comunidade')}
    `,
  });
  return { subject, html, text };
}

export function betaRejected(props: {
  firstName: string;
  adminNote?: string | null;
}): RenderedEmail {
  const subject = 'Actualização sobre o seu pedido';
  const note = props.adminNote?.trim();
  const text = `Olá ${props.firstName},\n\nO pedido de acesso não foi aprovado neste momento.${note ? `\n\nNota: ${note}` : ''}\n— Ekanda`;
  const html = mailLayout({
    preview: 'Actualização sobre pedido de acesso',
    title: 'Pedido não aprovado',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.firstName)}</strong>,`)}
      ${paragraph('Obrigado pelo interesse na Ekanda. Neste momento o seu pedido de acesso <strong>não foi aprovado</strong>.')}
      ${note ? highlightBox(`<strong>Nota da equipa:</strong><br/>${e(note)}`) : ''}
      ${muted('Pode voltar a pedir acesso mais tarde, se abrirmos novas vagas.')}
    `,
  });
  return { subject, html, text };
}
