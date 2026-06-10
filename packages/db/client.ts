/**
 * Database client — Neon PostgreSQL + Drizzle ORM.
 * SD §5: Neon managed DB, Drizzle ORM (lightweight, fast cold start).
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as accountingSchema from './schema/accounting';
import * as auditSchema from './schema/audit';
import * as authSchema from './schema/auth';
import * as cmsSchema from './schema/cms';
import * as commonSchema from './schema/common';
import * as crmSchema from './schema/crm';
import * as customFieldSchema from './schema/customfield';
import * as hrSchema from './schema/hr';
import * as inventorySchema from './schema/inventory';
import * as kitchenSchema from './schema/kitchen';
import * as memberSchema from './schema/member';
import * as notificationSchema from './schema/notification';
import * as posSchema from './schema/pos';
import * as purchasingSchema from './schema/purchasing';
import * as dailyRevenueAdjustmentSchema from './schema/reporting/daily-revenue-adjustments';
import * as scheduledJobsSchema from './schema/scheduled-jobs';
import * as stockOpnameSchema from './schema/stock-opname';
import * as workflowSchema from './schema/workflow';

const DATABASE_URL = process.env.DATABASE_URL;
const isProductionRuntime =
  process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build';

if (!DATABASE_URL && isProductionRuntime) {
  throw new Error('DATABASE_URL is required for production database access.');
}

const sql = postgres(
  DATABASE_URL ?? 'postgresql://missing:missing@127.0.0.1:5432/missing_database',
  { max: 5 },
);

export const db = drizzle(sql, {
  schema: {
    ...authSchema,
    ...accountingSchema,
    ...auditSchema,
    ...cmsSchema,
    ...commonSchema,
    ...crmSchema,
    ...customFieldSchema,
    ...hrSchema,
    ...inventorySchema,
    ...kitchenSchema,
    ...memberSchema,
    ...notificationSchema,
    ...posSchema,
    ...purchasingSchema,
    ...dailyRevenueAdjustmentSchema,
    ...scheduledJobsSchema,
    ...stockOpnameSchema,
    ...workflowSchema,
  },
});

export type Database = typeof db;
