/**
 * Public API — list open job openings for the careers page.
 * Read-only, no auth required.
 */

import { and, db, eq, isNull, sql } from '@erp/db';
import { jobOpenings } from '@erp/db/schema/hr';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db
      .select({
        id: jobOpenings.id,
        title: jobOpenings.title,
        department: jobOpenings.department,
        summary: jobOpenings.summary,
        requirements: jobOpenings.requirements,
        benefits: jobOpenings.benefits,
        headcount: jobOpenings.headcount,
        closeDate: jobOpenings.closeDate,
      })
      .from(jobOpenings)
      .where(
        and(
          eq(jobOpenings.tenantId, 'default'),
          eq(jobOpenings.status, 'open'),
          isNull(jobOpenings.deletedAt),
          sql`(${jobOpenings.closeDate} IS NULL OR ${jobOpenings.closeDate} >= ${today})`,
        ),
      )
      .limit(50);
    return NextResponse.json({ openings: rows });
  } catch {
    return NextResponse.json({ openings: [] }, { status: 500 });
  }
}
