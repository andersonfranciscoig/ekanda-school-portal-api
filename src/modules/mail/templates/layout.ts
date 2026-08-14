/** Tokens visuais Ekanda — alinhados com a landing (mark âmbar + primary preto). */
export const MAIL = {
  bg: '#f5f5f5',
  card: '#ffffff',
  ink: '#000000',
  muted: '#737373',
  mark: '#e89b1e',
  lagoon: '#0d9488',
  lagoonSoft: '#d5f5f2',
  border: '#e5e5e5',
  button: '#000000',
  buttonText: '#ffffff',
} as const;

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function e(value: string): string {
  return escapeHtml(value);
}

/** Logo Ekanda (mark «e» + ponto âmbar) — igual à landing, compatível com clientes de email. */
export function mailBrandLogo(inverted = false): string {
  const wordColor = inverted ? '#ffffff' : MAIL.ink;
  const markBg = inverted ? '#ffffff' : '#000000';
  const markLetter = inverted ? '#000000' : '#ffffff';
  const dotRing = inverted ? markBg : MAIL.card;

  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 4px">
  <tr>
    <td style="padding-right:10px;vertical-align:middle">
      <table role="presentation" cellspacing="0" cellpadding="0">
        <tr>
          <td style="width:32px;height:32px;background:${markBg};border-radius:8px;text-align:center;vertical-align:middle;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:700;line-height:32px;color:${markLetter}">e</td>
          <td style="width:6px;font-size:0;line-height:0">&nbsp;</td>
          <td style="vertical-align:bottom;padding-bottom:1px">
            <div style="width:8px;height:8px;background:${MAIL.mark};border-radius:999px;border:2px solid ${dotRing}"></div>
          </td>
        </tr>
      </table>
    </td>
    <td style="vertical-align:middle;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;letter-spacing:-0.02em;color:${wordColor}">Ekanda</td>
  </tr>
</table>`;
}

export function mailButton(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px">
  <tr>
    <td style="border-radius:12px;background:${MAIL.button}">
      <a href="${e(href)}" target="_blank" rel="noopener"
        style="display:inline-block;padding:14px 28px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;color:${MAIL.buttonText};text-decoration:none;border-radius:12px">
        ${e(label)}
      </a>
    </td>
  </tr>
</table>`;
}

export function mailOtpBoxes(code: string): string {
  const digits = code.replace(/\D/g, '').padEnd(6, '•').slice(0, 6).split('');
  const cells = digits
    .map(
      (d) =>
        `<td style="width:44px;height:52px;text-align:center;vertical-align:middle;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:24px;font-weight:700;color:${MAIL.ink};background:${MAIL.lagoonSoft};border:1px solid ${MAIL.border};border-radius:10px">${e(d)}</td>`,
    )
    .join('<td style="width:8px"></td>');

  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto"><tr>${cells}</tr></table>`;
}

export function mailLayout(opts: {
  preview: string;
  title: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  const year = new Date().getFullYear();
  const footer =
    opts.footerNote ??
    'Recebeu este email porque tem actividade na Ekanda. Se não reconhece, ignore.';

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>${e(opts.title)}</title>
  <!--[if mso]><style>body{font-family:Arial,sans-serif}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${MAIL.bg};font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${MAIL.ink}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(opts.preview)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${MAIL.bg};padding:40px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px">
          <tr>
            <td style="height:4px;border-radius:16px 16px 0 0;background:linear-gradient(90deg,${MAIL.mark} 0%,${MAIL.lagoon} 100%);font-size:0;line-height:0">&nbsp;</td>
          </tr>
          <tr>
            <td style="background:${MAIL.card};border:1px solid ${MAIL.border};border-top:none;border-radius:0 0 16px 16px;padding:36px 40px 40px;box-shadow:0 12px 40px rgba(0,0,0,0.06)">
              ${mailBrandLogo()}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 28px">
                <tr><td style="height:1px;background:${MAIL.border};font-size:0;line-height:0">&nbsp;</td></tr>
              </table>
              <h1 style="margin:0 0 20px;font-size:24px;font-weight:600;line-height:1.3;letter-spacing:-0.02em;color:${MAIL.ink}">${e(opts.title)}</h1>
              ${opts.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 12px 0;text-align:center">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.65;color:${MAIL.muted}">${e(footer)}</p>
              <p style="margin:0;font-size:11px;color:${MAIL.muted}">© ${year} Ekanda · Angola</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${MAIL.ink}">${text}</p>`;
}

export function muted(text: string): string {
  return `<p style="margin:0 0 12px;font-size:13px;line-height:1.65;color:${MAIL.muted}">${text}</p>`;
}

export function highlightBox(html: string): string {
  return `<div style="margin:20px 0;padding:16px 18px;background:${MAIL.lagoonSoft};border:1px solid ${MAIL.border};border-left:3px solid ${MAIL.lagoon};border-radius:12px;font-size:14px;line-height:1.65;color:${MAIL.ink}">${html}</div>`;
}
