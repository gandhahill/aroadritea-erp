import * as path from 'path';
import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: ['./schema/*.ts', './schema/**/*.ts'],
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
