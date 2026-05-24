import type { Page, PageScope } from '@gabi/core';
import type { AppAbility } from './auth.js';

export function canUserAccessPage(
  userId: string | undefined,
  page: Pick<Page, 'scope' | 'ownerUserId'>,
  ability?: AppAbility,
): boolean {
  if (ability?.can('manage', 'all')) return true;
  if (page.scope === 'global') return Boolean(userId);
  return Boolean(userId && page.ownerUserId && page.ownerUserId === userId);
}

export function resolvePageScope(
  scope: PageScope,
  userId: string | undefined,
): { scope: PageScope; ownerUserId: string | undefined } {
  if (scope === 'private') {
    if (!userId) throw new Error('Usuário obrigatório para página privada');
    return { scope: 'private', ownerUserId: userId };
  }
  return { scope: 'global', ownerUserId: undefined };
}

