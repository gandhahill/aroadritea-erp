/**
 * Seed only Aroadri Tea product menu and modifiers.
 *
 * Usage:
 *   pnpm seed:menu
 */

import { db } from '@erp/db';
import { seedMenu } from '../packages/db/seed/menu';

const tenantId = process.env.TENANT_ID ?? 'default';

async function main(): Promise<void> {
  const result = await seedMenu(db, tenantId);

  console.info(
    `[seed-menu] Seeded ${result.categories} categories, ${result.products} products, ${result.modifierGroups} modifier groups for tenant ${tenantId}`,
  );
}

main().catch((error) => {
  console.error('[seed-menu] Failed to seed Aroadri Tea menu:', error);
  process.exit(1);
});
