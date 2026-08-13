# Acesso beta fechado (MVP)

Gate de comunidade para o lançamento restrito da Ekanda.

## Comportamento

Com **Beta activo** (Admin → Configurações):

1. Qualquer URL da app (excepto `/admin/*`, `/comunidade`, `/legal/*`) redirecciona para `/comunidade`
2. O utilizador pede acesso com **email + telefone** → fica `PENDING`
3. O admin aprova em **Admin → Fila Beta**
4. O utilizador volta, escolhe **Já faço parte**, confirma os mesmos dados
5. A API define o cookie httpOnly `ekanda_beta` (14 dias) e mostra boas-vindas + link WhatsApp

**Admins Ekanda** (`EKANDA_ADMIN`) não passam pelo gate.
Contas existentes **não** saltam o gate — têm de pedir e ser aprovadas.

Com Beta **inactivo**, a plataforma fica aberta a todos.

## API

| Método | Path | Auth |
|--------|------|------|
| GET | `/platform/settings` | público |
| PATCH | `/admin/platform/settings` | admin |
| POST | `/beta/requests` | público (rate-limit) |
| POST | `/beta/verify` | público → cookie |
| GET | `/beta/session` | cookie |
| POST | `/beta/logout` | cookie |
| GET | `/admin/beta-requests` | admin |
| POST | `/admin/beta-requests/:id/review` | admin |

## Deploy

1. Migrar API: `npx prisma migrate deploy`
2. Seed opcional: `npx prisma db seed` (cria `platform_settings`)
3. No Render, garantir `JWT_SECRET` (e opcionalmente `JWT_BETA_SECRET`)
4. Deploy frontend
5. Em produção: Admin → Configurações → activar Beta + URL WhatsApp

## Segurança (limites honestos)

- Cookie httpOnly + hash do `jti` na BD — **partilhar o link da app não dá acesso**
- Reconfirmação email+telefone após aprovação
- Rate-limit nos POSTs públicos
- Headers `X-Frame-Options: DENY` / `frame-ancestors 'none'`
- CSS anti-seleção/print na página comunidade

**Nota:** bloquear captura de ecrã do sistema operativo a 100% **não é possível** num browser. O controlo real é aprovação + cookie + gate.

## Teste rápido

```bash
# settings
curl -s "$API/api/v1/platform/settings"

# pedir acesso
curl -s -X POST "$API/api/v1/beta/requests" \
  -H 'Content-Type: application/json' \
  -d '{"email":"teste@ekanda.ao","phone":"923000001"}'

# (como admin) aprovar na UI /admin/fila-beta
# depois verify com credentials para receber Set-Cookie
```
