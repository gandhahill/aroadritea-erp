/**
 * Database client — Neon PostgreSQL + Drizzle ORM.
 * SD §5: Neon managed DB, Drizzle ORM (lightweight, fast cold start).
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as authSchema from './schema/auth';
import * as accountingSchema from './schema/accounting';

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, {
  schema: {
    ...authSchema,
    ...accountingSchema,
  },
});

export type Database = typeof db;
