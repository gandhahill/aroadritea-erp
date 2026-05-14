/**
 * Seed only Aroadri Tea product menu and modifiers.
 *
 * Usage:
 *   pnpm seed:menu
 */

import { db } from '@erp/db';
import { seedMenu } from '../packages/db/seed/menu';

const tenantId = process.env.TENANT_ID ?? 'default';

const result = await seedMenu(db, tenantId);

console.info(
  `[seed-menu] Seeded ${result.categories} categories, ${result.products} products, ${result.modifierGroups} modifier groups for tenant ${tenantId}`,
);
