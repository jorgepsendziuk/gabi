# Scripts SQL — GABI

## Supabase (banco META)

| Arquivo | Uso |
|---------|-----|
| [`supabase/01_gabi_schema.sql`](supabase/01_gabi_schema.sql) | Tabelas GABI: auth, conexões, páginas, `gabi_odk_change` |
| [`supabase/02_gabi_permissions_seed.sql`](supabase/02_gabi_permissions_seed.sql) | Role `admin` + permissões base |
| [`supabase/03_env_exemplo.md`](supabase/03_env_exemplo.md) | `.env` da API apontando para Supabase |

**Ordem:** `01` → `02` → `pnpm db:seed` (cria usuário admin com bcrypt).

## Postgres ODK (banco externo — somente leitura)

| Arquivo | Uso |
|---------|-----|
| [`odk/01_odk_readonly_user.sql`](odk/01_odk_readonly_user.sql) | SQL manual: role + GRANT SELECT |
| [`odk/02_odk_readonly_psql.sh`](odk/02_odk_readonly_psql.sh) | Shell automatizado via `psql` |

**No GABI:** Conexões → marcar **Fonte ODK** → introspectar → gerar listas/mapas.

## Arquitetura

```
Supabase (meta)                    Postgres ODK (cliente)
├── gabi_user                      ├── submissions (SELECT only)
├── gabi_connection  ─────────────►├── … tabelas ODK
├── gabi_odk_change  ◄── writes    └── (nunca INSERT/UPDATE/DELETE pelo GABI)
└── gabi_page / gabi_data_source
```
