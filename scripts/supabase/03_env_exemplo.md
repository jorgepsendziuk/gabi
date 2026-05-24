# GABI no Supabase — variáveis de ambiente

Use o banco **Supabase** apenas como **meta** (este schema). O ODK fica em outro host.

## Connection string (Settings → Database)

**Session pooler** (recomendado para API Node local):

```env
DB_HOST=aws-1-us-east-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.gjtgxnmodzsnnqosxpgl
DB_PASSWORD=SUA_SENHA
DB_SSL=true
```

Ou cole a URI inteira do dashboard:

```env
DATABASE_URL=postgresql://postgres.gjtgxnmodzsnnqosxpgl:...@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

**Transaction pooler** (serverless / muitas conexões curtas):

```env
DB_PORT=6543
```

**Session mode / conexão direta** (migrations, introspection pesada):

```env
DB_HOST=db.SEU_PROJECT_REF.supabase.co
DB_PORT=5432
```

## `apps/api/.env` completo (exemplo)

```env
PORT=4000
NODE_ENV=production

DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=...
DB_SSL=true

JWT_SECRET=gerar-string-longa-aleatoria
JWT_EXPIRES_IN=24h

CONNECTION_SECRET=outra-string-para-criptografar-senhas-de-conexao

ADMIN_EMAIL=admin@seudominio.com
ADMIN_PASSWORD=...

CORS_ORIGIN=https://seu-admin.vercel.app
```

## Ordem de execução

1. SQL Editor: `01_gabi_schema.sql`
2. SQL Editor: `02_gabi_permissions_seed.sql`
3. Local: `pnpm db:seed` (cria hash do admin)
4. Admin → **Conexões** → cadastrar Postgres ODK (usuário somente leitura)
