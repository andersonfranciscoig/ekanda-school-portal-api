# Contrato AGT — consulta de NIF

A lógica de negócio (submissão, estados, emails, audit) **não** conhece a rota HTTP da AGT.
Só fala com a porta `NifLookupPort`.

## Onde mudar quando a AGT publicar outra rota

| Ficheiro | O quê |
|----------|--------|
| `.env` (`AGT_NIF_LOOKUP_*`) | Base URL, path (`{nif}`), método, API key, timeout |
| `infrastructure/agt/agt-nif-lookup.contract.ts` | Shape documentado do JSON |
| `infrastructure/agt/map-agt-nif-lookup-response.ts` | Aliases dos campos → snapshot Ekanda |

## Toggle operacional

- Default: **desactivado** (`platform_settings.autoNifVerificationEnabled = false`)
- Admin activa em Configurações após credenciamento
- Kill-switch: `SCHOOL_LEGAL_AUTO_NIF_ENABLED=false`

## Snapshot interno (estável)

```ts
{
  nif, nome, tipo, estado, inadimplente, regimeIva, residenciaFiscal, consultedAt
}
```

Veredictos: `ACTIVE` | `INACTIVE` | `NOT_FOUND` | `UNKNOWN`
