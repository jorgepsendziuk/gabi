/** Helpers para cadastrar Postgres no Supabase (pooler ou direct). */

export type SupabasePoolerMode = 'session' | 'transaction' | 'direct';

export interface ConnectionFields {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export interface ParsedConnectionUri extends Partial<ConnectionFields> {
  error?: string;
}

/** Extrai project ref de usuário pooler (`postgres.abc123`) ou host direct. */
export function extractSupabaseProjectRef(host: string, user: string): string | undefined {
  const fromUser = user.match(/\.([a-z0-9]{15,25})$/i)?.[1];
  if (fromUser) return fromUser;
  return host.match(/^db\.([a-z0-9]{15,25})\.supabase\.co$/i)?.[1];
}

export function isSupabaseHost(host: string): boolean {
  return host.includes('supabase.com') || host.includes('supabase.co');
}

/** Parse URI Postgres (dashboard Supabase → Connection string). */
export function parsePostgresUri(raw: string): ParsedConnectionUri {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  try {
    const normalized = trimmed.startsWith('postgres://')
      ? trimmed.replace(/^postgres:\/\//, 'postgresql://')
      : trimmed;

    if (!normalized.startsWith('postgresql://')) {
      return { error: 'URI deve começar com postgresql:// ou postgres://' };
    }

    const parsed = new URL(normalized);
    const database = parsed.pathname.replace(/^\//, '') || 'postgres';
    const ssl =
      parsed.searchParams.get('sslmode') === 'require' ||
      parsed.hostname.includes('supabase.com') ||
      parsed.hostname.includes('supabase.co');

    return {
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      database,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      ssl,
    };
  } catch {
    return { error: 'URI inválida — copie do Supabase → Settings → Database' };
  }
}

/** Direct: db.{ref}.supabase.co (migrations, introspecção pesada). */
export function supabaseDirectPreset(projectRef: string): ConnectionFields {
  const ref = projectRef.trim().toLowerCase();
  return {
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: '',
    ssl: true,
  };
}

/**
 * Pooler session/transaction — host regional vem do dashboard ou do meta GABI.
 * Usuário pooler: postgres.{ref}
 */
export function supabasePoolerPreset(
  projectRef: string,
  poolerHost: string,
  mode: SupabasePoolerMode,
): ConnectionFields {
  const ref = projectRef.trim().toLowerCase();
  const host = poolerHost.trim();
  return {
    host,
    port: mode === 'transaction' ? 6543 : 5432,
    database: 'postgres',
    user: `postgres.${ref}`,
    password: '',
    ssl: true,
  };
}
