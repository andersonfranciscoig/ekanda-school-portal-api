import {
  e,
  highlightBox,
  mailButton,
  mailLayout,
  paragraph,
  type RenderedEmail,
} from './layout';

export function billingPaymentConfirmed(props: {
  ownerName: string;
  schoolName: string;
  planName: string;
  amountLabel: string;
  dashboardUrl: string;
}): RenderedEmail {
  const subject = 'Pagamento confirmado';
  const text = `Olá ${props.ownerName},\n\nPagamento confirmado — ${props.planName} (${props.amountLabel}).\n— Ekanda`;
  const html = mailLayout({
    preview: 'Pagamento confirmado',
    title: 'Pagamento confirmado',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('Confirmamos o pagamento do plano para <strong>' + e(props.schoolName) + '</strong>.')}
      ${highlightBox(`
        <strong>Plano:</strong> ${e(props.planName)}<br/>
        <strong>Valor:</strong> ${e(props.amountLabel)}
      `)}
      ${mailButton(props.dashboardUrl, 'Ver subscrição')}
    `,
  });
  return { subject, html, text };
}

export function billingSubscriptionExpiring(props: {
  ownerName: string;
  schoolName: string;
  planName: string;
  daysRemaining: number;
  renewUrl: string;
}): RenderedEmail {
  const subject = `Plano expira em ${props.daysRemaining} dias`;
  const text = `Olá ${props.ownerName},\n\nPlano ${props.planName} expira em ${props.daysRemaining} dias.\n— Ekanda`;
  const html = mailLayout({
    preview: `Plano expira em ${props.daysRemaining} dias`,
    title: 'Plano a expirar',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('O plano <strong>' + e(props.planName) + '</strong> de <strong>' + e(props.schoolName) + '</strong> expira em <strong>' + props.daysRemaining + ' dias</strong>.')}
      ${mailButton(props.renewUrl, 'Renovar plano')}
    `,
  });
  return { subject, html, text };
}

export function billingSubscriptionExpired(props: {
  ownerName: string;
  schoolName: string;
  planName: string;
  renewUrl: string;
}): RenderedEmail {
  const subject = 'Plano Ekanda expirado';
  const text = `Olá ${props.ownerName},\n\nPlano ${props.planName} expirou.\n— Ekanda`;
  const html = mailLayout({
    preview: 'Plano expirado',
    title: 'Plano expirado',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.ownerName)}</strong>,`)}
      ${paragraph('O plano <strong>' + e(props.planName) + '</strong> de <strong>' + e(props.schoolName) + '</strong> expirou.')}
      ${paragraph('O perfil ficará oculto no marketplace até renovar. Os dados permanecem guardados.')}
      ${mailButton(props.renewUrl, 'Renovar agora')}
    `,
  });
  return { subject, html, text };
}
