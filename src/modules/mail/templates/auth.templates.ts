import {
  e,
  highlightBox,
  mailButton,
  mailLayout,
  mailOtpBoxes,
  muted,
  paragraph,
  type RenderedEmail,
} from './layout';

export function authVerifyOtp(props: {
  firstName: string;
  otp: string;
  expiresMinutes: number;
}): RenderedEmail {
  const subject = `${props.otp} — código de verificação Ekanda`;
  const text = `Olá ${props.firstName},\n\nO seu código Ekanda é: ${props.otp}\nExpira em ${props.expiresMinutes} minutos.\n\n— Ekanda`;
  const html = mailLayout({
    preview: `Código ${props.otp} para concluir o registo`,
    title: 'Verifique o seu email',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.firstName)}</strong>,`)}
      ${paragraph('Use o código abaixo para concluir a criação da sua conta Ekanda.')}
      ${mailOtpBoxes(props.otp)}
      ${muted(`Este código expira em <strong>${props.expiresMinutes} minutos</strong>. Não partilhe com ninguém.`)}
      ${highlightBox('Se não pediu este código, pode ignorar este email com segurança.')}
    `,
  });
  return { subject, html, text };
}

export function authPasswordReset(props: {
  firstName: string;
  resetUrl: string;
  expiresMinutes: number;
}): RenderedEmail {
  const subject = 'Redefinir a sua palavra-passe Ekanda';
  const text = `Olá ${props.firstName},\n\nRedefina a palavra-passe: ${props.resetUrl}\n\nExpira em ${props.expiresMinutes} minutos.\n— Ekanda`;
  const html = mailLayout({
    preview: 'Link para redefinir palavra-passe',
    title: 'Redefinir palavra-passe',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.firstName)}</strong>,`)}
      ${paragraph('Recebemos um pedido para redefinir a palavra-passe da sua conta.')}
      ${mailButton(props.resetUrl, 'Redefinir palavra-passe')}
      ${muted(`O link expira em ${props.expiresMinutes} minutos.`)}
      ${highlightBox(`Se não fez este pedido, ignore este email. A sua conta permanece segura.`)}
    `,
  });
  return { subject, html, text };
}

export function authPasswordChanged(props: { firstName: string }): RenderedEmail {
  const subject = 'Palavra-passe alterada com sucesso';
  const text = `Olá ${props.firstName},\n\nA palavra-passe da sua conta Ekanda foi alterada.\n— Ekanda`;
  const html = mailLayout({
    preview: 'Confirmação de alteração de palavra-passe',
    title: 'Palavra-passe actualizada',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.firstName)}</strong>,`)}
      ${paragraph('Confirmamos que a palavra-passe da sua conta foi alterada com sucesso.')}
      ${highlightBox('Não foi você? Contacte-nos imediatamente em ekandacode@gmail.com')}
    `,
  });
  return { subject, html, text };
}

export function authWelcomeGuardian(props: {
  firstName: string;
  dashboardUrl: string;
}): RenderedEmail {
  const subject = 'Bem-vindo à Ekanda';
  const text = `Olá ${props.firstName},\n\nConta de encarregado criada. Aceda: ${props.dashboardUrl}\n— Ekanda`;
  const html = mailLayout({
    preview: 'A sua conta de encarregado está pronta',
    title: 'Bem-vindo à Ekanda',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.firstName)}</strong>,`)}
      ${paragraph('A sua conta de <strong>encarregado de educação</strong> foi criada com sucesso.')}
      ${paragraph('Explore colégios, compare opções e acompanhe candidaturas num só lugar.')}
      ${mailButton(props.dashboardUrl, 'Ir para o meu painel')}
    `,
  });
  return { subject, html, text };
}

export function authWelcomeSchoolOwner(props: {
  firstName: string;
  onboardingUrl: string;
}): RenderedEmail {
  const subject = 'Bem-vindo — comece o cadastro do colégio';
  const text = `Olá ${props.firstName},\n\nConta criada. Cadastre o colégio: ${props.onboardingUrl}\n— Ekanda`;
  const html = mailLayout({
    preview: 'Próximo passo: cadastrar o colégio',
    title: 'Bem-vindo à Ekanda',
    bodyHtml: `
      ${paragraph(`Olá <strong>${e(props.firstName)}</strong>,`)}
      ${paragraph('A sua conta de <strong>instituição</strong> foi criada com sucesso.')}
      ${paragraph('O próximo passo é completar o cadastro do colégio — perfil, localização, oferta e galeria.')}
      ${mailButton(props.onboardingUrl, 'Começar cadastro')}
    `,
  });
  return { subject, html, text };
}
