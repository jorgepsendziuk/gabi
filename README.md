# GABI Framework

**G**eo-**A**plicações & **B**usiness **I**ntelligence — framework mínimo para ERPs geoespaciais.

Substitui o fluxo do Adianti Builder por uma stack moderna: **React + Node + PostgreSQL/PostGIS**, com introspecção de banco, geração de listagens/mapas, auth, RBAC e auditoria.

## Dois níveis de banco

| Papel | Onde configurar | Função |
|-------|-----------------|--------|
| **Banco meta** | `apps/api/.env` (`DB_HOST`, `DB_NAME`, …) | Usuários, papéis, `gabi_connection`, páginas geradas, auditoria |
| **Bancos de dados** | Admin → **Conexões** ou `POST /api/connections` | PostgreSQL dos clientes/ERP/ODK que você introspecta e vira telas |

Um projeto GABI pode ter **várias conexões** (multi-banco). Cada tabela gerada fica ligada à conexão de origem; listagens e mapas consultam o pool correto.

```
.env (meta) ──► Postgres GABI
                    ├── gabi_connection (N bases)
                    ├── gabi_page / gabi_data_source
                    └── pools ──► Postgres cliente A, B, C…
```

## Stack

| Camada | Tecnologias |
|--------|-------------|
| Frontend | Vite, React, Refine, Tailwind, TanStack Table, MapLibre |
| Backend | Express, Passport/JWT, CASL, pg, Kysely |
| Banco | PostgreSQL 15 + PostGIS |
| Monorepo | pnpm + Turborepo |

## Scripts SQL (Supabase + ODK)

Scripts prontos em [`scripts/`](scripts/README.md):

- **Supabase (meta):** `scripts/supabase/01_gabi_schema.sql` + `02_gabi_permissions_seed.sql`
- **Postgres ODK (read-only):** `scripts/odk/01_odk_readonly_user.sql` ou `scripts/odk/02_odk_readonly_psql.sh`

## Início rápido

### 1. Subir infraestrutura

```bash
pnpm db:up
```

Aguarde o Postgres ficar saudável (`docker compose ps`).

### 2. Instalar dependências

```bash
pnpm install
pnpm build
```

### 3. Migrar e popular

```bash
cp apps/api/.env.example apps/api/.env   # se ainda não existir
pnpm db:migrate
pnpm db:seed
```

### 4. Cadastrar banco de dados

No admin: **Conexões** → host, database, usuário, senha → **Testar** → **Salvar**.

Em **Banco de dados**, escolha a conexão e gere **Lista** / **Mapa** para as tabelas desejadas.

### 5. Rodar em desenvolvimento

```bash
pnpm dev
```

- **Admin:** http://localhost:5173  
- **API:** http://localhost:4000/health  

**Login padrão:** `admin@gabi.local` / `admin123`

## Deploy na Vercel (admin)

O build do Vite gera **`apps/admin/dist`**, não `public`. O `vercel.json` na raiz já aponta para isso.

1. **Root Directory:** deixe vazio (raiz do repo) ou `apps/admin` (usa o `vercel.json` local).
2. **Output Directory:** não use `public` — deixe o `vercel.json` definir (`apps/admin/dist` ou `dist`).
3. **Variável de ambiente:** `VITE_API_URL` = URL pública da API (ex.: `https://sua-api.railway.app`).

A API (`apps/api`) deve ser hospedada separadamente (Railway, Render, Fly.io, etc.).

## Estrutura

```
apps/
  api/      # Express REST
  admin/    # Painel Refine
packages/
  core/           # Tipos e metamodelo
  db/             # pg + Kysely
  introspector/   # Leitura do information_schema + PostGIS
  runtime/        # CRUD dinâmico seguro
  generator/      # Geração de páginas/permissões
  odk/            # Detector ODK (v1)
  ui/             # DataGridPro, GeoMap
  cli/            # Comando `gabi`
```

## CLI

```bash
pnpm gabi connect
pnpm gabi introspect
pnpm gabi generate --connection <id> --schema public --table minha_tabela --template list
```

Com `GABI_ADMIN_TOKEN` (JWT do admin) e `GABI_API_URL`, o generate persiste via API.

## Dados ODK (somente leitura + overlay)

Para Postgres com formulários ODK:

1. **Conexões** → marque **Fonte ODK (somente leitura + overlay GABI)** ao cadastrar o banco ODK.
2. **ODK** → painel somente leitura: plataforma (Central/Aggregate), usuários, catálogo de formulários, preferências do servidor (`GET /api/odk/overview`).
3. **Banco de dados** → introspecção detecta formulários ODK (tabela principal + repeats) e permite gerar listas/mapas em lote; overlay automático em fontes ODK.
3. **Leitura:** sempre do Postgres ODK original.
4. **Escrita:** `CREATE` / `UPDATE` / `DELETE` vão para `gabi_odk_change` no banco **meta** (nunca alteram o ODK).
5. **Exibição:** cada registro traz `_gabi` com estado (`original`, `alterado`, `novo`, `excluído`) e, quando aplicável, `_gabi.original` com o valor antes das edições.

```
Postgres ODK (read-only)     Postgres GABI meta
       │                           │
       └──── SELECT ───────────────┤
                                   ├── gabi_odk_change (alterações)
                                   └── merge → UI (dado atualizado)
```

API: `PATCH /api/runtime/:dataSourceId/records/:recordId` grava overlay; listagens já retornam o merge.

## Fluxo MVP

1. Login no admin  
2. **Conexões** — cadastrar Postgres de dados (ODK, ERP, etc.)  
3. **ODK** — visão da instalação (usuários, formulários, servidor)  
4. **Banco de dados** — introspectar e gerar **Lista** / **Mapa**  
5. Abrir páginas geradas no painel  
6. **Auditoria** — ver ações registradas  

## Critérios de sucesso

- [x] `pnpm dev` sobe API + admin  
- [x] Login admin  
- [x] Introspecção de tabelas  
- [x] Listagem com busca, paginação, export CSV  
- [x] Mapa GeoJSON para tabela com geometria  
- [x] Audit log e RBAC (403 sem permissão)  

## Roadmap

- Wizard visual completo  
- ODK avançado  
- Dashboards, PDF, BullMQ  
- DB Viewer, Page Builder (GrapesJS)  
- Plugin `@gabi/plugin-prisma`  

## Licença

Privado — uso interno.
