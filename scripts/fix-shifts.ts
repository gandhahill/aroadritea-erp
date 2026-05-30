import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { shiftDefinitions } from '@erp/db/schema/hr';
import { locations } from '@erp/db/schema/auth';
import { and, eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import { generateId } from '@erp/shared/id';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function run() {
  const locs = await db.select().from(locations).where(eq(locations.status, 'active'));
  console.log(`Found ${locs.length} active locations.`);

  // Get shifts from Malioboro (or any first location that has them)
  let templateShifts = [];
  for (const loc of locs) {
    templateShifts = await db.select().from(shiftDefinitions).where(eq(shiftDefinitions.locationId, loc.id));
    if (templateShifts.length > 0) {
      console.log(`Found ${templateShifts.length} template shifts in ${loc.name}.`);
      break;
    }
  }

  if (templateShifts.length === 0) {
    console.log('No template shifts found in any location.');
    return;
  }

  // Ensure ALL active locations have these shifts
  for (const loc of locs) {
    const existing = await db.select().from(shiftDefinitions).where(eq(shiftDefinitions.locationId, loc.id));
    if (existing.length === 0) {
      console.log(`Location ${loc.name} has no shifts. Copying ${templateShifts.length} shifts...`);
      for (const t of templateShifts) {
        await db.insert(shiftDefinitions).values({
          id: generateId(),
          tenantId: t.tenantId,
          locationId: loc.id,
          code: t.code,
          name: t.name,
          startTime: t.startTime,
          endTime: t.endTime,
          breakStart: t.breakStart,
          breakEnd: t.breakEnd,
          isActive: t.isActive,
        }).onConflictDoNothing();
      }
      console.log(`  -> Copied to ${loc.name}`);
    } else {
      console.log(`Location ${loc.name} already has ${existing.length} shifts.`);
    }
  }
}

run().catch(console.error);
