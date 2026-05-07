/**
 * Database client — Neon PostgreSQL + Drizzle ORM.
 * SD §5: Neon managed DB, Drizzle ORM (lightweight, fast cold start).
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as authSchema from './schema/auth';
import * as accountingSchema from './schema/accounting';
import * as auditSchema from './schema/audit';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set — database queries will fail. Add it to .env');
}

const sql = neon(DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost/placeholder');

export const db = drizzle(sql, {
  schema: {
    ...authSchema,
    ...accountingSchema,
    ...auditSchema,
  },
});

export type Database = typeof db;
