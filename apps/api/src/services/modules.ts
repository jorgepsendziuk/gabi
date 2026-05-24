import { randomUUID } from 'node:crypto';
import type { GabiModule } from '@gabi/core';
import { NotFoundError, GabiError } from '@gabi/core';
import { getDefaultPool, query } from '@gabi/db';

interface ModuleRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  page_count?: number;
}

function mapModule(r: ModuleRow): GabiModule {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? undefined,
    icon: r.icon ?? undefined,
    sortOrder: r.sort_order,
    enabled: r.enabled,
    pageCount: r.page_count !== undefined ? Number(r.page_count) : undefined,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listModules(): Promise<GabiModule[]> {
  const pool = getDefaultPool();
  const rows = await query<ModuleRow>(
    pool,
    `
    SELECT m.*, COUNT(p.id)::int AS page_count
    FROM gabi_module m
    LEFT JOIN gabi_page p ON p.module_id = m.id
    WHERE m.enabled = true
    GROUP BY m.id
    ORDER BY m.sort_order, m.name
    `,
  );
  return rows.map(mapModule);
}

export async function getModuleById(id: string): Promise<GabiModule> {
  const pool = getDefaultPool();
  const rows = await query<ModuleRow>(
    pool,
    `
    SELECT m.*, COUNT(p.id)::int AS page_count
    FROM gabi_module m
    LEFT JOIN gabi_page p ON p.module_id = m.id
    WHERE m.id = $1
    GROUP BY m.id
    `,
    [id],
  );
  if (!rows[0]) throw new NotFoundError(`Módulo não encontrado: ${id}`);
  return mapModule(rows[0]);
}

export interface CreateModuleInput {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
}

export async function createModule(input: CreateModuleInput): Promise<GabiModule> {
  const pool = getDefaultPool();
  const id = randomUUID();
  const slug =
    input.slug ??
    input.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const existing = await query<{ id: string }>(
    pool,
    `SELECT id FROM gabi_module WHERE slug = $1`,
    [slug],
  );
  if (existing[0]) {
    throw new GabiError(`Slug já em uso: ${slug}`, 'MODULE_SLUG_EXISTS', 409);
  }

  await query(
    pool,
    `
    INSERT INTO gabi_module (id, name, slug, description, icon, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      id,
      input.name,
      slug,
      input.description ?? null,
      input.icon ?? null,
      input.sortOrder ?? 0,
    ],
  );
  return getModuleById(id);
}

export interface UpdateModuleInput {
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
}

export async function updateModule(id: string, input: UpdateModuleInput): Promise<GabiModule> {
  const pool = getDefaultPool();
  const current = await getModuleById(id);

  const name = input.name ?? current.name;
  const slug = input.slug ?? current.slug;
  const description =
    input.description !== undefined ? input.description : (current.description ?? null);
  const icon = input.icon !== undefined ? input.icon : (current.icon ?? null);
  const sortOrder = input.sortOrder ?? current.sortOrder;

  if (slug !== current.slug) {
    const dup = await query<{ id: string }>(
      pool,
      `SELECT id FROM gabi_module WHERE slug = $1 AND id <> $2`,
      [slug, id],
    );
    if (dup[0]) throw new GabiError(`Slug já em uso: ${slug}`, 'MODULE_SLUG_EXISTS', 409);
  }

  await query(
    pool,
    `
    UPDATE gabi_module SET
      name = $2, slug = $3, description = $4, icon = $5, sort_order = $6, updated_at = NOW()
    WHERE id = $1
    `,
    [id, name, slug, description, icon, sortOrder],
  );
  return getModuleById(id);
}

export async function deleteModule(id: string): Promise<void> {
  if (id === 'mod_default') {
    throw new GabiError('O módulo padrão não pode ser removido', 'MODULE_PROTECTED', 400);
  }
  const pool = getDefaultPool();
  await getModuleById(id);
  await query(pool, `UPDATE gabi_page SET module_id = 'mod_default' WHERE module_id = $1`, [id]);
  await query(pool, `DELETE FROM gabi_module WHERE id = $1`, [id]);
}
