/**
 * Envio manual de teste — template auth.welcome-guardian via Brevo.
 * Uso: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/send-test-welcome.ts [email] [firstName]
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { authWelcomeGuardian } from '../src/modules/mail/templates/auth.templates';

function loadEnv(): void {
  const envPath = resolve(__dirname, '../.env');
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadEnv();

  const toEmail = process.argv[2] ?? 'andersonfranciscoig@gmail.com';
  const firstName = process.argv[3] ?? 'Anderson';
  const apiKey = process.env.EMAIL_API_KEY?.trim();
  const fromEmail = process.env.EMAIL_FROM ?? 'notifications@ekanda.ao';
  const fromName = process.env.EMAIL_FROM_NAME ?? 'Ekanda';
  const replyTo = process.env.EMAIL_REPLY_TO ?? 'ekandacode@gmail.com';
  const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );

  if (!apiKey) {
    console.error('EMAIL_API_KEY em falta no .env');
    process.exit(1);
  }

  const rendered = authWelcomeGuardian({
    firstName,
    dashboardUrl: `${frontendUrl}/encarregado`,
  });

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: toEmail, name: firstName }],
      replyTo: { email: replyTo, name: 'Ekanda' },
      subject: rendered.subject,
      htmlContent: rendered.html,
      textContent: rendered.text,
      tags: ['auth.welcome-guardian', 'test'],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`Brevo error ${res.status}: ${body}`);
    process.exit(1);
  }

  const data = (await res.json()) as { messageId?: string };
  console.log(
    `OK — email enviado para ${toEmail} (template: auth.welcome-guardian, messageId: ${data.messageId ?? 'n/a'})`,
  );
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
