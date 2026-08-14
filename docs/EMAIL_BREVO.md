# Email com Brevo (Ekanda API)

A API envia todos os emails transaccionais via [Brevo](https://www.brevo.com/) (API REST). Em dev e produção usamos `EMAIL_PROVIDER=brevo`. Para testes sem envio real, use `EMAIL_PROVIDER=console` — o OTP aparece no **subject** dos logs da API.

## Variáveis de ambiente

| Variável | Exemplo | Descrição |
|----------|---------|-----------|
| `EMAIL_PROVIDER` | `brevo` | `brevo` (dev + prod) ou `console` (só logs) |
| `EMAIL_API_KEY` | `xkeysib-…` | Chave API transaccional Brevo |
| `EMAIL_FROM` | `notifications@ekanda.ao` | Remetente — **tem de estar verificado** no Brevo |
| `EMAIL_FROM_NAME` | `Ekanda` | Nome exibido |
| `EMAIL_REPLY_TO` | `ekandacode@gmail.com` | Resposta aos emails |
| `EMAIL_OPS` | `ekandacode@gmail.com` | Alertas internos (ops, beta, colégios) |
| `EMAIL_OTP_SECRET` | *(opcional)* | Pepper do OTP; default = `JWT_SECRET` |

### Produção / staging

```env
EMAIL_PROVIDER=brevo
EMAIL_API_KEY=xkeysib-sua-chave-aqui
EMAIL_FROM=notifications@ekanda.ao
EMAIL_FROM_NAME=Ekanda
EMAIL_REPLY_TO=ekandacode@gmail.com
EMAIL_OPS=ekandacode@gmail.com
```

### Desenvolvimento local (Brevo)

```env
EMAIL_PROVIDER=brevo
EMAIL_API_KEY=xkeysib-sua-chave-aqui
EMAIL_FROM=notifications@ekanda.ao
```

> Se o domínio `ekanda.ao` ainda não estiver verificado, use temporariamente um sender verificado no Brevo (ex. Gmail) em `EMAIL_FROM`.

### Desenvolvimento sem envio (console)

```env
EMAIL_PROVIDER=console
```

Reiniciar a API após alterar o `.env`.

---

## 1. Conta Brevo

1. Criar conta em [brevo.com](https://www.brevo.com/) (plano gratuito: ~300 emails/dia).
2. **Settings → SMTP & API → API keys** → Create API key → permissão **Send transactional emails**.
3. Copiar a chave para `EMAIL_API_KEY`.

---

## 2. Autorizar IPs (obrigatório se activo na conta)

O Brevo pode bloquear **API keys e SMTP** quando o IP de origem não está na lista branca.

1. Abrir [app.brevo.com/security/authorised_ips](https://app.brevo.com/security/authorised_ips)
2. **Desenvolvimento local:** adicionar o IP público actual (ex. `154.127.148.142` — confirmar com `curl https://api.ipify.org`)
3. **Produção (Render):** **desactivar** a restrição por IP ou o envio falha (IPs de saída do Render são dinâmicos)

Erro típico:
```json
{"code":"unauthorized","message":"We have detected you are using an unrecognised IP address …"}
```

---

## 3. Verificar domínio `ekanda.ao`

Sem domínio verificado, o Brevo bloqueia envios de `notifications@ekanda.ao`.

1. **Senders, Domains & Dedicated IPs → Domains** → Add a domain → `ekanda.ao`.
2. O Brevo mostra registos DNS. Adicionar no painel do registrador (onde gere o domínio):

| Tipo | Nome / Host | Valor (exemplo) |
|------|-------------|-----------------|
| TXT | `@` ou `ekanda.ao` | Verificação Brevo (código fornecido) |
| TXT | `mail._domainkey` | DKIM (valor longo do Brevo) |
| TXT | `@` | SPF: `v=spf1 include:sendinblue.com ~all` |
| CNAME | `brevo._domainkey` | *(se o Brevo pedir)* |
| DMARC | `_dmarc` | `v=DMARC1; p=none; rua=mailto:ekandacode@gmail.com` |

3. Aguardar propagação (minutos a 48 h) e clicar **Verify** no Brevo.
4. Confirmar que `notifications@ekanda.ao` aparece como remetente válido (ou adicionar em **Senders**).

> **Teste rápido sem domínio:** adicione um sender individual (ex. Gmail) em Brevo → Senders e use temporariamente `EMAIL_FROM=seu@gmail.com`. Só para testes — em produção use `ekanda.ao`.

---

## 4. Testar envio

Script de teste (template boas-vindas):

```bash
cd ekanda-school-portal-api
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/send-test-welcome.ts seu@email.com Nome
```

Ou via registo OTP (`EMAIL_PROVIDER=brevo`):

```bash
# Registo com OTP (frontend /auth/criar-conta ou API directa)
curl -X POST http://localhost:3000/auth/register/start \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","firstName":"Teste","lastName":"Ekanda","password":"Senha123!","role":"GUARDIAN"}'
```

Verificar:
- Email recebido (inbox + spam)
- Logs da API sem `Brevo error`
- Dashboard Brevo → **Transactional → Email activity**

---

## 5. Erros comuns

| Erro / sintoma | Causa | Solução |
|----------------|-------|---------|
| `EMAIL_API_KEY em falta` | Variável vazia com `EMAIL_PROVIDER=brevo` | Definir chave no `.env` |
| Brevo `401` unrecognised IP | IP não está na lista autorizada | [Autorizar IP](#2-autorizar-ips-obrigatório-se-activo-na-conta) ou desactivar restrição |
| Brevo `401` invalid key | API key inválida | Regenerar chave em SMTP & API → API keys |
| Brevo `error` sender not valid | `EMAIL_FROM` não verificado (ex. `notifications@ekanda.ao` sem DNS) | Usar sender activo no Brevo ou verificar domínio |
| Email não chega | SPF/DKIM pendentes | Completar DNS e verificar domínio |
| OTP em dev | — | Usar `EMAIL_PROVIDER=console` e ler logs |

---

## Arquitectura no código

```
Use cases → MailService → MailPort
                              ├─ ConsoleMailAdapter  (dev)
                              └─ BrevoMailAdapter    (produção)
```

Templates: `src/modules/mail/templates/` (23 emails incl. OTP, beta, colégios, billing).
