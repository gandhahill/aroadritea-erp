/**
 * attendance.checkIn / checkOut — SD §21.8 §Attendance SOP
 *
 * Mobile-first GPS check-in (geofence per location) with:
 * - GPS location verification (per-location radius, default 150m)
 * - Shift-based late detection (grace: 15 min per SOP)
 * - Late minutes recorded for payroll deduction
 * - Late penalty tracking (configurable via Settings → Attendance Policy)
 */

import { db } from '@erp/db';
import { locations, users } from '@erp/db/schema/auth';
import { customFieldDefinitions, customFieldValues } from '@erp/db/schema/customfield';
import {
  attendance,
  employeeFaceTemplates,
  employees,
  shiftAssignments,
  shiftDefinitions,
} from '@erp/db/schema/hr';
import { AppError } from '@erp/shared/errors';
import { generateId } from '@erp/shared/id';
import { type Result, err, ok, tryCatch } from '@erp/shared/result';
import type { AuditContext } from '@erp/shared/types';
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { auditRecord } from '../audit';
import { requirePermission } from '../iam';
import { decryptPii, encryptPii } from '../security/pii';
import { resolveEmployeeForUser } from './resolve-employee';

// ─── Types ───────────────────────────────────────────────────────────────────

/** GPS data shape stored in JSONB */
export interface GpsData {
  lat: number;
  lng: number;
  accuracy_m: number;
  source?: string; // 'geolocation_api' | 'manual'
}

/** Attendance record shape returned by checkIn */
export interface CheckInResult {
  id: string;
  employeeId: string;
  checkInAt: Date;
  checkInMethod: 'gps';
  isLate: boolean;
  lateMinutes: number;
  shiftCode: string | null;
}

export interface CheckOutResult {
  id: string;
  checkOutAt: Date;
  workedMinutes: number | null;
}

export interface LocationGpsConfig {
  lat: number;
  lng: number;
  radiusM: number;
}

export interface FaceTemplatePayload {
  version: 'faceapi-128-v1';
  descriptor: number[];
  quality: number;
  faceDetected?: boolean;
  capturedAt?: string;
}

interface StoredFaceTemplate {
  version: 'faceapi-128-v1';
  descriptor: number[];
  quality: number;
  enrolledAt: string;
}

const GPS_HARD_ACCURACY_LIMIT_M = 500;
const GPS_RADIUS_BUFFER_M = 25;
const FACE_TEMPLATE_MIN_QUALITY = 20;
const FACE_MATCH_SCORE_THRESHOLD = 45;

// ─── Input schemas ───────────────────────────────────────────────────────────

const GpsDataSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy_m: z.number().optional().default(10),
  source: z.string().optional().default('geolocation_api'),
});

const FaceTemplateSchema = z.object({
  version: z.literal('faceapi-128-v1'),
  descriptor: z.array(z.number()).length(128),
  quality: z.number().int().min(0).max(100),
  faceDetected: z.boolean().optional(),
  capturedAt: z.string().datetime().optional(),
});

export const CheckInInputSchema = z.object({
  employeeId: z.string().min(1).optional(),
  shiftDefinitionId: z.string().optional(), // if null, derive from employee's current schedule
  method: z.enum(['gps']),
  gpsData: GpsDataSchema.optional(),
  photoUrl: z.string().url().optional(),
  faceTemplate: FaceTemplateSchema.optional(),
  enrollFace: z.boolean().optional().default(false),
  /** Override current date/time (for testing/import) */
  performedAt: z.string().datetime().optional(),
});

export type CheckInInput = z.infer<typeof CheckInInputSchema>;

export const CheckOutInputSchema = z.object({
  attendanceId: z.string().min(1),
  gpsData: GpsDataSchema.optional(),
  photoUrl: z.string().url().optional(),
  performedAt: z.string().datetime().optional(),
});

export type CheckOutInput = z.infer<typeof CheckOutInputSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate distance between two GPS coordinates (Haversine formula).
 * Returns distance in meters.
 */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function effectiveAttendanceRadiusM(radiusM: number, accuracyM: number): number {
  const safeRadius = Number.isFinite(radiusM) && radiusM > 0 ? radiusM : 150;
  const safeAccuracy = Number.isFinite(accuracyM) && accuracyM > 0 ? accuracyM : 0;
  return safeRadius + Math.min(safeAccuracy, GPS_HARD_ACCURACY_LIMIT_M) + GPS_RADIUS_BUFFER_M;
}

/**
 * Parse "HH:MM" shift time + today's date → Date in WIB (UTC+7).
 */
function shiftTimeToDate(startTime: string, referenceDate: Date): Date {
  const parts = startTime.split(':').map((s) => Number.parseInt(s, 10));
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const wibDate = new Date(referenceDate.getTime() + 7 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(wibDate.getUTCFullYear(), wibDate.getUTCMonth(), wibDate.getUTCDate(), h - 7, m, 0, 0),
  );
}

function wibDayBounds(referenceDate: Date): { start: Date; end: Date } {
  const wibDate = new Date(referenceDate.getTime() + 7 * 60 * 60 * 1000);
  const start = new Date(
    Date.UTC(wibDate.getUTCFullYear(), wibDate.getUTCMonth(), wibDate.getUTCDate(), -7, 0, 0, 0),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

export function resolveShiftTime(shiftDef: any, referenceDate: Date): { startTime: string; endTime: string } {
  const overrides = shiftDef.overrides as {
    date?: Record<string, { startTime: string; endTime: string }>;
    dayOfWeek?: Record<number, { startTime: string; endTime: string }>;
  } | null | undefined;
  
  if (!overrides) {
    return { startTime: shiftDef.startTime, endTime: shiftDef.endTime };
  }

  const wibDate = new Date(referenceDate.getTime() + 7 * 60 * 60 * 1000);
  const dateStr = `${wibDate.getUTCFullYear()}-${String(wibDate.getUTCMonth() + 1).padStart(2, '0')}-${String(wibDate.getUTCDate()).padStart(2, '0')}`;
  const dayOfWeek = wibDate.getUTCDay();

  if (overrides.date && overrides.date[dateStr]) {
    return overrides.date[dateStr];
  }

  if (overrides.dayOfWeek && overrides.dayOfWeek[dayOfWeek]) {
    return overrides.dayOfWeek[dayOfWeek];
  }

  return { startTime: shiftDef.startTime, endTime: shiftDef.endTime };
}

/**
 * Calculate late minutes: diff in minutes between actual check-in and expected shift start.
 * Grace period: 15 minutes (SD §21.8 SOP).
 * Returns 0 if on time (within grace).
 */
function calcLateMinutes(actualCheckIn: Date, expectedShiftStart: Date): number {
  const diffMs = actualCheckIn.getTime() - expectedShiftStart.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const GRACE_MIN = 15;
  if (diffMin <= GRACE_MIN) return 0;
  return diffMin;
}

export async function getLocationGpsConfig(
  tenantId: string,
  locationId: string,
): Promise<LocationGpsConfig | null> {
  // Prefer native columns on the locations table (added by migration 0006).
  const nativeRow = await db
    .select({
      gpsLat: locations.gpsLat,
      gpsLng: locations.gpsLng,
      gpsRadiusM: locations.gpsRadiusM,
    })
    .from(locations)
    .where(and(eq(locations.tenantId, tenantId), eq(locations.id, locationId)))
    .limit(1);

  const native = nativeRow[0];
  if (native?.gpsLat && native?.gpsLng) {
    const lat = Number(native.gpsLat);
    const lng = Number(native.gpsLng);
    const radiusM = Number(native.gpsRadiusM ?? 150);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radiusM)) {
      return { lat, lng, radiusM };
    }
  }

  // Backward-compat fallback: custom-field-driven config (pre-migration).
  const rows = await db
    .select({
      key: customFieldDefinitions.key,
      value: customFieldValues.value,
    })
    .from(customFieldDefinitions)
    .innerJoin(customFieldValues, eq(customFieldValues.definitionId, customFieldDefinitions.id))
    .where(
      and(
        eq(customFieldDefinitions.tenantId, tenantId),
        eq(customFieldDefinitions.entityType, 'location'),
        eq(customFieldValues.entityId, locationId),
      ),
    );

  const values = new Map(rows.map((row) => [row.key, Number(row.value)]));
  const lat = values.get('gps_lat');
  const lng = values.get('gps_lng');
  const radiusM = values.get('gps_radius_m') ?? 150;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusM)) return null;
  return { lat: lat!, lng: lng!, radiusM };
}

// ─── Face Verification Mock (T-0254) ─────────────────────────────────────────

const FACE_TEMPLATE_FIELD = 'employee_face_templates.template_ciphertext';

function validateFaceTemplatePayload(template: FaceTemplatePayload): void {
  if (template.faceDetected === false) {
    throw AppError.validation('hr.attendance.faceNotDetected');
  }
  if (template.quality < FACE_TEMPLATE_MIN_QUALITY) {
    throw AppError.validation('hr.attendance.faceTemplateQualityLow', {
      quality: template.quality,
      minQuality: FACE_TEMPLATE_MIN_QUALITY,
    });
  }
}

function faceTemplateScore(currentDescriptor: number[], storedDescriptor: number[]): number {
  if (currentDescriptor.length !== 128 || storedDescriptor.length !== 128) return 0;

  let sum = 0;
  for (let i = 0; i < 128; i += 1) {
    const diff = (currentDescriptor[i] ?? 0) - (storedDescriptor[i] ?? 0);
    sum += diff * diff;
  }
  const distance = Math.sqrt(sum);

  // Euclidean distance mapping:
  // distance 0.0 -> score 100
  // distance 0.6 -> score 62
  const score = Math.max(0, 100 - (distance / 0.6) * 38);
  return Math.min(100, Math.round(score));
}

function parseStoredFaceTemplate(ciphertext: string): StoredFaceTemplate {
  const plain = decryptPii(ciphertext, FACE_TEMPLATE_FIELD);
  if (!plain) {
    throw AppError.internal(
      'hr.attendance.faceTemplateDecryptFailed',
      new Error('Empty face template payload'),
    );
  }

  const parsed = JSON.parse(plain) as Record<string, unknown>;
  if (parsed.version === 'ahash-16x16-v1') {
    throw AppError.validation('hr.attendance.faceEnrollmentRequired', {
      message: 'Sistem absensi menggunakan AI wajah versi terbaru. Silakan enroll wajah ulang.',
    });
  }

  if (
    parsed.version !== 'faceapi-128-v1' ||
    !Array.isArray(parsed.descriptor) ||
    parsed.descriptor.length !== 128
  ) {
    throw AppError.internal(
      'hr.attendance.faceTemplateInvalid',
      new Error('Invalid stored face template payload'),
    );
  }
  return parsed as unknown as StoredFaceTemplate;
}

async function loadEmployeeFaceTemplate(tenantId: string, employeeId: string) {
  const [row] = await db
    .select({
      id: employeeFaceTemplates.id,
      employeeId: employeeFaceTemplates.employeeId,
      templateVersion: employeeFaceTemplates.templateVersion,
      templateCiphertext: employeeFaceTemplates.templateCiphertext,
      templateQuality: employeeFaceTemplates.templateQuality,
      status: employeeFaceTemplates.status,
      enrolledAt: employeeFaceTemplates.enrolledAt,
      lastVerifiedAt: employeeFaceTemplates.lastVerifiedAt,
      failedAttempts: employeeFaceTemplates.failedAttempts,
    })
    .from(employeeFaceTemplates)
    .where(
      and(
        eq(employeeFaceTemplates.tenantId, tenantId),
        eq(employeeFaceTemplates.employeeId, employeeId),
        eq(employeeFaceTemplates.status, 'active'),
        isNull(employeeFaceTemplates.deletedAt),
      ),
    )
    .limit(1);

  return row ?? null;
}

async function enrollEmployeeFaceTemplate(params: {
  template: FaceTemplatePayload;
  employeeId: string;
  locationId: string;
  performedAt: Date;
  ctx: AuditContext;
}): Promise<{ templateId: string; score: number }> {
  const normalizedTemplate: StoredFaceTemplate = {
    version: params.template.version,
    descriptor: params.template.descriptor,
    quality: params.template.quality,
    enrolledAt: params.performedAt.toISOString(),
  };
  const encrypted = encryptPii(JSON.stringify(normalizedTemplate), FACE_TEMPLATE_FIELD);
  if (!encrypted) {
    throw AppError.internal(
      'hr.attendance.faceTemplateEncryptFailed',
      new Error('Face template encryption returned empty payload'),
    );
  }

  const [existing] = await db
    .select({
      id: employeeFaceTemplates.id,
      templateVersion: employeeFaceTemplates.templateVersion,
      templateQuality: employeeFaceTemplates.templateQuality,
      status: employeeFaceTemplates.status,
      enrolledAt: employeeFaceTemplates.enrolledAt,
    })
    .from(employeeFaceTemplates)
    .where(
      and(
        eq(employeeFaceTemplates.tenantId, params.ctx.tenantId),
        eq(employeeFaceTemplates.employeeId, params.employeeId),
        isNull(employeeFaceTemplates.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(employeeFaceTemplates)
      .set({
        locationId: params.locationId,
        templateVersion: normalizedTemplate.version,
        templateCiphertext: encrypted,
        templateQuality: normalizedTemplate.quality,
        status: 'active',
        enrolledAt: params.performedAt,
        lastVerifiedAt: params.performedAt,
        failedAttempts: 0,
        updatedAt: new Date(),
        updatedBy: params.ctx.userId,
      })
      .where(
        and(
          eq(employeeFaceTemplates.id, existing.id),
          eq(employeeFaceTemplates.tenantId, params.ctx.tenantId),
        ),
      )
      .returning({
        id: employeeFaceTemplates.id,
        templateVersion: employeeFaceTemplates.templateVersion,
        templateQuality: employeeFaceTemplates.templateQuality,
        status: employeeFaceTemplates.status,
        enrolledAt: employeeFaceTemplates.enrolledAt,
      });

    await auditRecord({
      action: 'update',
      entityType: 'employee_face_template',
      entityId: existing.id,
      before: {
        templateVersion: existing.templateVersion,
        templateQuality: existing.templateQuality,
        status: existing.status,
        enrolledAt: existing.enrolledAt,
      },
      after: updated ?? null,
      metadata: { employeeId: params.employeeId, reason: 'attendance_inline_enrollment' },
      ctx: params.ctx,
    });

    return { templateId: existing.id, score: 100 };
  }

  const templateId = generateId();
  const [created] = await db
    .insert(employeeFaceTemplates)
    .values({
      id: templateId,
      tenantId: params.ctx.tenantId,
      locationId: params.locationId,
      employeeId: params.employeeId,
      templateVersion: normalizedTemplate.version,
      templateCiphertext: encrypted,
      templateQuality: normalizedTemplate.quality,
      status: 'active',
      enrolledAt: params.performedAt,
      lastVerifiedAt: params.performedAt,
      failedAttempts: 0,
      createdBy: params.ctx.userId,
      updatedBy: params.ctx.userId,
    })
    .returning({
      id: employeeFaceTemplates.id,
      employeeId: employeeFaceTemplates.employeeId,
      templateVersion: employeeFaceTemplates.templateVersion,
      templateQuality: employeeFaceTemplates.templateQuality,
      status: employeeFaceTemplates.status,
      enrolledAt: employeeFaceTemplates.enrolledAt,
    });

  await auditRecord({
    action: 'create',
    entityType: 'employee_face_template',
    entityId: templateId,
    before: null,
    after:
      created ??
      ({
        id: templateId,
        employeeId: params.employeeId,
        templateVersion: normalizedTemplate.version,
        templateQuality: normalizedTemplate.quality,
        status: 'active',
        enrolledAt: params.performedAt,
      } as Record<string, unknown>),
    metadata: { employeeId: params.employeeId, reason: 'attendance_inline_enrollment' },
    ctx: params.ctx,
  });

  return { templateId, score: 100 };
}

async function verifyOrEnrollFaceTemplate(params: {
  template: FaceTemplatePayload | undefined;
  enrollFace: boolean;
  employeeId: string;
  locationId: string;
  performedAt: Date;
  ctx: AuditContext;
}): Promise<{ isVerified: boolean; score: number; templateId: string; enrolled: boolean }> {
  const existing = await loadEmployeeFaceTemplate(params.ctx.tenantId, params.employeeId);

  if (!params.template) {
    throw AppError.validation(
      existing
        ? 'hr.attendance.faceVerificationRequired'
        : 'hr.attendance.faceEnrollmentRequired',
    );
  }

  validateFaceTemplatePayload(params.template);

  if (!existing) {
    if (!params.enrollFace) {
      throw AppError.validation('hr.attendance.faceEnrollmentRequired');
    }
    const enrolled = await enrollEmployeeFaceTemplate({
      template: params.template,
      employeeId: params.employeeId,
      locationId: params.locationId,
      performedAt: params.performedAt,
      ctx: params.ctx,
    });
    return {
      isVerified: true,
      score: enrolled.score,
      templateId: enrolled.templateId,
      enrolled: true,
    };
  }

  const storedTemplate = parseStoredFaceTemplate(existing.templateCiphertext);
  const score = faceTemplateScore(params.template.descriptor, storedTemplate.descriptor);

  if (score < FACE_MATCH_SCORE_THRESHOLD) {
    await db
      .update(employeeFaceTemplates)
      .set({
        failedAttempts: sql`${employeeFaceTemplates.failedAttempts} + 1`,
        updatedAt: new Date(),
        updatedBy: params.ctx.userId,
      })
      .where(
        and(
          eq(employeeFaceTemplates.id, existing.id),
          eq(employeeFaceTemplates.tenantId, params.ctx.tenantId),
        ),
      );

    await auditRecord({
      action: 'update',
      entityType: 'employee_face_template',
      entityId: existing.id,
      before: { failedAttempts: existing.failedAttempts },
      after: { failedAttempts: Number(existing.failedAttempts ?? 0) + 1 },
      metadata: {
        employeeId: params.employeeId,
        reason: 'attendance_face_mismatch',
        score,
        threshold: FACE_MATCH_SCORE_THRESHOLD,
      },
      ctx: params.ctx,
    });

    throw AppError.validation('hr.attendance.faceMismatch', {
      score,
      threshold: FACE_MATCH_SCORE_THRESHOLD,
    });
  }

  await db
    .update(employeeFaceTemplates)
    .set({
      lastVerifiedAt: params.performedAt,
      failedAttempts: 0,
      updatedAt: new Date(),
      updatedBy: params.ctx.userId,
    })
    .where(
      and(
        eq(employeeFaceTemplates.id, existing.id),
        eq(employeeFaceTemplates.tenantId, params.ctx.tenantId),
      ),
    );

  await auditRecord({
    action: 'update',
    entityType: 'employee_face_template',
    entityId: existing.id,
    before: {
      lastVerifiedAt: existing.lastVerifiedAt,
      failedAttempts: existing.failedAttempts,
    },
    after: {
      lastVerifiedAt: params.performedAt,
      failedAttempts: 0,
    },
    metadata: {
      employeeId: params.employeeId,
      reason: 'attendance_face_verified',
      score,
    },
    ctx: params.ctx,
  });

  return { isVerified: true, score, templateId: existing.id, enrolled: false };
}

// ─── checkIn ────────────────────────────────────────────────────────────────

export async function checkIn(
  input: CheckInInput,
  ctx: AuditContext,
): Promise<Result<CheckInResult>> {
  const parsed = CheckInInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('hr.attendance.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  return tryCatch(
    async () => {
      let resolvedEmployeeId = data.employeeId;
      if (!resolvedEmployeeId) {
        const emp = await resolveEmployeeForUser(ctx.tenantId, ctx.userId);
        if (!emp) throw AppError.businessRule('hr.attendance.employeeNotResolved');
        resolvedEmployeeId = emp.id;
      }

      const [employee] = await db
        .select({
          id: employees.id,
          locationId: employees.locationId,
          status: employees.status,
        })
        .from(employees)
        .where(
          and(
            eq(employees.id, resolvedEmployeeId),
            eq(employees.tenantId, ctx.tenantId),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1);

      if (!employee) {
        throw AppError.notFound('hr.employee.notFound', { employeeId: resolvedEmployeeId });
      }
      if (employee.status === 'terminated') {
        throw AppError.businessRule('hr.attendance.employeeTerminated', {
          employeeId: resolvedEmployeeId,
        });
      }

      const performedAt = data.performedAt ? new Date(data.performedAt) : new Date();
      const wibDate = new Date(performedAt.getTime() + 7 * 60 * 60 * 1000);
      const workDateStr = `${wibDate.getUTCFullYear()}-${String(wibDate.getUTCMonth() + 1).padStart(2, '0')}-${String(wibDate.getUTCDate()).padStart(2, '0')}`;

      const [assignment] = await db
        .select({
          locationId: shiftAssignments.locationId,
          shiftDefinitionId: shiftAssignments.shiftDefinitionId,
        })
        .from(shiftAssignments)
        .where(
          and(
            eq(shiftAssignments.tenantId, ctx.tenantId),
            eq(shiftAssignments.employeeId, employee.id),
            eq(shiftAssignments.workDate, workDateStr),
            eq(shiftAssignments.kind, 'shift'),
            ...(data.shiftDefinitionId
              ? [eq(shiftAssignments.shiftDefinitionId, data.shiftDefinitionId)]
              : []),
            isNull(shiftAssignments.deletedAt),
          ),
        )
        .orderBy(desc(shiftAssignments.updatedAt))
        .limit(1);

      const targetLocationId = employee.locationId;
      const targetShiftDefinitionId = assignment?.shiftDefinitionId ?? data.shiftDefinitionId;

      // Target location might be different from assignment if checking in via GPS.
      // But we require permission to write attendance at that location.
      // If it's self-service, does the user have hr.attendance.write?
      // For self-service, they usually only have 'hr.attendance.self_service' or we just allow it if they are checking themselves in.
      if (data.employeeId) {
        const selfEmp = await resolveEmployeeForUser(ctx.tenantId, ctx.userId);
        if (!selfEmp || data.employeeId !== selfEmp.id) {
          const permCheck = await requirePermission(ctx.userId, 'hr.attendance.write', {
            locationId: targetLocationId,
          });
          if (!permCheck.ok) throw permCheck.error;
        }
      }

      // 1. Derive shift definition
      let shiftDef = null;
      if (targetShiftDefinitionId) {
        const [sd] = await db
          .select()
          .from(shiftDefinitions)
          .where(
            and(
              eq(shiftDefinitions.id, targetShiftDefinitionId),
              eq(shiftDefinitions.tenantId, ctx.tenantId),
              eq(shiftDefinitions.isActive, true),
              isNull(shiftDefinitions.deletedAt),
            ),
          )
          .limit(1);
        if (!sd) {
          throw AppError.notFound('hr.attendance.shiftNotFound', {
            shiftDefinitionId: targetShiftDefinitionId,
          });
        }
        shiftDef = sd;
      }

      // 2. Check for duplicate check-in on the same WIB operational day.
      const { start: todayStart, end: todayEnd } = wibDayBounds(performedAt);

      const [existing] = await db
        .select({ id: attendance.id })
        .from(attendance)
        .where(
          and(
            eq(attendance.employeeId, resolvedEmployeeId),
            eq(attendance.tenantId, ctx.tenantId),
            eq(attendance.locationId, targetLocationId),
            isNull(attendance.deletedAt),
            // Pass Date objects through Drizzle's typed operators, not the raw
            // `sql` tag: postgres-js cannot bind a JS Date as a parameter in a
            // raw template (it has no column codec there) and throws
            // ERR_INVALID_ARG_TYPE, surfacing as an opaque INTERNAL error that
            // blocked every check-in.
            gte(attendance.checkInAt, todayStart),
            lte(attendance.checkInAt, todayEnd),
          ),
        )
        .limit(1);

      if (existing) {
        throw AppError.conflict('hr.attendance.alreadyCheckedIn', { employeeId: resolvedEmployeeId });
      }

      // 3. GPS verification (if GPS method)
      if (data.method === 'gps') {
        if (!data.gpsData) {
          throw AppError.validation('hr.attendance.gpsRequired', {
            message: 'GPS check-in requires a current location reading.',
          });
        }
        const gps = data.gpsData;
        if (gps.accuracy_m > GPS_HARD_ACCURACY_LIMIT_M) {
          throw AppError.validation('hr.attendance.gpsInaccurate', {
            accuracy: gps.accuracy_m,
            maxAccuracy: GPS_HARD_ACCURACY_LIMIT_M,
            message: 'Location accuracy too low. Please try again in an open area.',
          });
        }

        const locationGps = await getLocationGpsConfig(ctx.tenantId, targetLocationId);
        if (!locationGps) {
          throw AppError.validation('hr.attendance.gpsLocationNotConfigured', {
            locationId: targetLocationId,
            message: 'GPS coordinates for this location are not configured.',
          });
        }

        const distanceM = haversineM(gps.lat, gps.lng, locationGps.lat, locationGps.lng);
        const effectiveRadiusM = effectiveAttendanceRadiusM(locationGps.radiusM, gps.accuracy_m);
        if (distanceM > effectiveRadiusM) {
          throw AppError.validation('hr.attendance.outsideLocationRadius', {
            distanceM: Math.round(distanceM),
            radiusM: locationGps.radiusM,
            accuracyM: Math.round(gps.accuracy_m),
            effectiveRadiusM: Math.round(effectiveRadiusM),
            message: 'You are outside the configured attendance radius for this location.',
          });
        }
      }

      // 4. Calculate late minutes
      let isLate = false;
      let lateMinutes = 0;
      let shiftCode: string | null = null;

      if (shiftDef) {
        const resolvedTimes = resolveShiftTime(shiftDef, performedAt);
        const shiftStart = shiftTimeToDate(resolvedTimes.startTime, performedAt);
        lateMinutes = calcLateMinutes(performedAt, shiftStart);
        isLate = lateMinutes > 0;
        shiftCode = shiftDef.code;
      }

      const faceVerification = await verifyOrEnrollFaceTemplate({
        template: data.faceTemplate,
        enrollFace: data.enrollFace,
        employeeId: resolvedEmployeeId,
        locationId: targetLocationId,
        performedAt,
        ctx,
      });

      // 5. Create attendance record
      const attId = generateId();
      const [record] = await db
        .insert(attendance)
        .values({
          id: attId,
          tenantId: ctx.tenantId,
          locationId: targetLocationId,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
          employeeId: resolvedEmployeeId,
          shiftDefinitionId: targetShiftDefinitionId ?? null,
          checkInAt: performedAt,
          checkInLocationId: targetLocationId,
          checkInMethod: data.method,
          checkInGps: data.gpsData ?? null,
          shiftDefinitionCode: shiftCode,
          isFaceVerified: faceVerification.isVerified,
          faceMatchScore: faceVerification.score,
          isLate,
          lateMinutes,
        })
        .returning({
          id: attendance.id,
          employeeId: attendance.employeeId,
          checkInAt: attendance.checkInAt,
          checkInMethod: attendance.checkInMethod,
          isLate: attendance.isLate,
          lateMinutes: attendance.lateMinutes,
          isFaceVerified: attendance.isFaceVerified,
          faceMatchScore: attendance.faceMatchScore,
          shiftCode: attendance.shiftDefinitionCode,
        });

      if (!record) {
        throw AppError.internal('hr.attendance.checkInFailed', new Error('No record returned'));
      }

      await auditRecord({
        action: 'check_in',
        entityType: 'attendance',
        entityId: record.id,
        before: null,
        after: record as never,
        metadata: {
          ip: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ?? null,
          faceTemplateId: faceVerification.templateId,
          faceEnrolled: faceVerification.enrolled,
        },
        ctx,
      });

      return {
        id: record.id,
        employeeId: record.employeeId,
        checkInAt: record.checkInAt!,
        checkInMethod: record.checkInMethod as 'gps',
        isLate: record.isLate,
        lateMinutes: Number(record.lateMinutes),
        shiftCode: record.shiftCode,
      };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.attendance.checkInFailed', e);
    },
  );
}

// ─── checkOut ────────────────────────────────────────────────────────────────

export async function checkOut(
  input: CheckOutInput,
  ctx: AuditContext,
): Promise<Result<CheckOutResult>> {
  const parsed = CheckOutInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(
      AppError.validation('hr.attendance.validationFailed', { issues: parsed.error.issues }),
    );
  }
  const data = parsed.data;

  return tryCatch(
    async () => {
      // Verify attendance record exists and not already checked out
      const [existing] = await db
        .select()
        .from(attendance)
        .where(and(eq(attendance.id, data.attendanceId), eq(attendance.tenantId, ctx.tenantId), isNull(attendance.deletedAt)))
        .limit(1);

      if (!existing) {
        throw AppError.notFound('hr.attendance.notFound', { attendanceId: data.attendanceId });
      }
      if (existing.checkOutAt) {
        throw AppError.conflict('hr.attendance.alreadyCheckedOut', {
          attendanceId: data.attendanceId,
        });
      }

      // Self-service checkout: if the attendance row belongs to the user's own
      // employee record, allow without hr.attendance.write permission (mirrors
      // the checkIn self-service pattern).
      const selfEmp = await resolveEmployeeForUser(ctx.tenantId, ctx.userId);
      const isSelfService = selfEmp && existing.employeeId === selfEmp.id;
      if (!isSelfService) {
        const permCheck = await requirePermission(ctx.userId, 'hr.attendance.write', {
          locationId: existing.locationId,
        });
        if (!permCheck.ok) throw permCheck.error;
      }

      const performedAt = data.performedAt ? new Date(data.performedAt) : new Date();

      // Calculate worked minutes (if shift definition available)
      let workedMinutes: number | null = null;
      if (existing.checkInAt && existing.shiftDefinitionCode) {
        const [shiftDef] = await db
          .select()
          .from(shiftDefinitions)
          .where(
            and(
              eq(shiftDefinitions.tenantId, ctx.tenantId),
              eq(shiftDefinitions.code, existing.shiftDefinitionCode),
              eq(shiftDefinitions.isActive, true),
              isNull(shiftDefinitions.deletedAt),
            ),
          )
          .limit(1);

        if (shiftDef) {
          const resolvedTimes = resolveShiftTime(shiftDef, existing.checkInAt);
          const shiftStart = shiftTimeToDate(resolvedTimes.startTime, existing.checkInAt);
          let shiftEnd = shiftTimeToDate(resolvedTimes.endTime, existing.checkInAt);
          // Cross-midnight shift (e.g., 22:00–06:00): end is next day
          if (shiftEnd.getTime() <= shiftStart.getTime()) {
            shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
          }
          const expectedDurationMin = Math.round(
            (shiftEnd.getTime() - shiftStart.getTime()) / 60000,
          );

          const actualWorkedMin = Math.round(
            (performedAt.getTime() - existing.checkInAt!.getTime()) / 60000,
          );
          workedMinutes = Math.min(actualWorkedMin, expectedDurationMin);
        }
      }

      // Atomic claim — the WHERE matches only attendance rows that
      // haven't been checked out yet, so two concurrent checkOut calls
      // (e.g., user double-tapping or auto-resync after offline)
      // produce one update and one orphaned conflict.
      const [updated] = await db
        .update(attendance)
        .set({
          checkOutAt: performedAt,
          checkOutGps: data.gpsData ?? null,
          workedMinutes,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(attendance.id, data.attendanceId),
            eq(attendance.tenantId, ctx.tenantId),
            isNull(attendance.checkOutAt),
          ),
        )
        .returning({
          id: attendance.id,
          checkOutAt: attendance.checkOutAt,
          workedMinutes: attendance.workedMinutes,
        });

      if (!updated) {
        throw AppError.conflict('hr.attendance.alreadyCheckedOut', {
          attendanceId: data.attendanceId,
        });
      }

      await auditRecord({
        action: 'check_out',
        entityType: 'attendance',
        entityId: data.attendanceId,
        before: { checkOutAt: null },
        after: { checkOutAt: updated.checkOutAt, workedMinutes: updated.workedMinutes } as never,
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return {
        id: updated.id,
        checkOutAt: updated.checkOutAt!,
        workedMinutes: updated.workedMinutes ? Number(updated.workedMinutes) : null,
      };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.attendance.checkOutFailed', e);
    },
  );
}

// ─── listAttendance (server-side for page) ────────────────────────────────────

export interface AttendanceListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftCode: string | null;
  checkInAt: Date;
  checkOutAt: Date | null;
  checkInMethod: string;
  isLate: boolean;
  lateMinutes: number;
  workedMinutes: number | null;
  lateForgiven: boolean;
  lateForgivenReason: string | null;
}

export interface ListAttendanceInput {
  employeeId?: string;
  dateFrom?: string; // ISO date
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export async function listAttendance(
  input: ListAttendanceInput,
  ctx: AuditContext,
): Promise<Result<{ items: AttendanceListItem[]; total: number }>> {
  const permCheck = await requirePermission(ctx.userId, 'hr.attendance.read', {
    locationId: ctx.locationId,
  });
  if (!permCheck.ok) return permCheck;

  return tryCatch(
    async () => {
      const conditions = [eq(attendance.tenantId, ctx.tenantId)];
      if (ctx.locationId) conditions.push(eq(attendance.locationId, ctx.locationId));
      conditions.push(isNull(attendance.deletedAt));
      if (input.employeeId) conditions.push(eq(attendance.employeeId, input.employeeId));
      // checkInAt is timestamptz. Bare date strings cast to midnight UTC, not
      // WIB — append +07:00 so PostgreSQL compares in WIB.
      if (input.dateFrom) conditions.push(sql`${attendance.checkInAt} >= ${`${input.dateFrom}T00:00:00+07:00`}`);
      if (input.dateTo) conditions.push(sql`${attendance.checkInAt} < ${`${input.dateTo}T00:00:00+07:00`}::timestamptz + interval '1 day'`);

      const whereClause = and(...conditions);
      const limit = Math.min(input.limit ?? 50, 200);
      const offset = input.offset ?? 0;

      const totalRow = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(attendance)
        .where(whereClause);
      const total = totalRow[0]?.count ?? 0;

      const rows = await db
        .select({
          id: attendance.id,
          employeeId: attendance.employeeId,
          checkInAt: attendance.checkInAt,
          checkOutAt: attendance.checkOutAt,
          checkInMethod: attendance.checkInMethod,
          isLate: attendance.isLate,
          lateMinutes: attendance.lateMinutes,
          workedMinutes: attendance.workedMinutes,
          shiftCode: attendance.shiftDefinitionCode,
          lateForgiven: attendance.lateForgiven,
          lateForgivenReason: attendance.lateForgivenReason,
        })
        .from(attendance)
        .where(whereClause)
        .orderBy(desc(attendance.checkInAt))
        .limit(limit)
        .offset(offset);

      // Batch-fetch employee names
      const empIds = [...new Set(rows.map((r) => r.employeeId))];
      let empNames: Map<string, string> = new Map();
      if (empIds.length > 0) {
        const empRows = await db
          .select({ id: employees.id, name: employees.name })
          .from(employees)
          .where(inArray(employees.id, empIds));
        empNames = new Map(empRows.map((r) => [r.id, r.name]));
      }

      const items: AttendanceListItem[] = rows.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: empNames.get(r.employeeId) ?? 'Unknown',
        shiftCode: r.shiftCode,
        checkInAt: r.checkInAt!,
        checkOutAt: r.checkOutAt,
        checkInMethod: r.checkInMethod,
        isLate: r.isLate,
        lateMinutes: Number(r.lateMinutes),
        workedMinutes: r.workedMinutes ? Number(r.workedMinutes) : null,
        lateForgiven: r.lateForgiven,
        lateForgivenReason: r.lateForgivenReason,
      }));

      return { items, total: Number(total) };
    },
    (e) => AppError.internal('hr.attendance.listFailed', e),
  );
}

// ─── forgiveLate (supervisor waives a late event) ─────────────────────────────

export async function forgiveLate(
  input: { attendanceId: string; reason: string },
  ctx: AuditContext,
): Promise<Result<{ id: string }>> {
  if (!input.attendanceId || !input.reason || input.reason.trim().length < 3) {
    return err(AppError.validation('hr.attendance.forgiveLate.invalid'));
  }

  return tryCatch(
    async () => {
      const [row] = await db
        .select({
          id: attendance.id,
          isLate: attendance.isLate,
          locationId: attendance.locationId,
          lateForgiven: attendance.lateForgiven,
          employeeId: attendance.employeeId,
        })
        .from(attendance)
        .where(and(eq(attendance.id, input.attendanceId), eq(attendance.tenantId, ctx.tenantId), isNull(attendance.deletedAt)))
        .limit(1);
      if (!row) {
        throw AppError.notFound('hr.attendance.notFound');
      }

      // Permission scoped to the attendance row's location — supervisor
      // at outlet A cannot waive late penalties for staff at outlet B.
      const perm = await requirePermission(ctx.userId, 'hr.manage_attendance', {
        locationId: row.locationId,
      });
      if (!perm.ok) {
        throw perm.error;
      }

      if (!row.isLate) {
        throw AppError.businessRule('hr.attendance.forgiveLate.notLate');
      }

      // Atomic claim — prevents two supervisors waiving the same late
      // event in parallel (which would otherwise write two audit rows).
      const claimed = await db
        .update(attendance)
        .set({
          lateForgiven: true,
          lateForgivenBy: ctx.userId,
          lateForgivenReason: input.reason.trim(),
          lateForgivenAt: new Date(),
        })
        .where(and(eq(attendance.id, input.attendanceId), eq(attendance.lateForgiven, false)))
        .returning({ id: attendance.id });
      if (!claimed || claimed.length === 0) {
        throw AppError.conflict('hr.attendance.forgiveLate.alreadyForgiven');
      }

      // ISO 38500 — supervisor waivers materially affect payroll and
      // disciplinary records, so capture before/after explicitly.
      await auditRecord({
        action: 'forgive_late',
        entityType: 'attendance',
        entityId: input.attendanceId,
        before: { lateForgiven: false },
        after: {
          lateForgiven: true,
          lateForgivenBy: ctx.userId,
          lateForgivenReason: input.reason.trim(),
          employeeId: row.employeeId,
        },
        metadata: { ip: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
        ctx,
      });

      return { id: input.attendanceId };
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.attendance.forgiveLate.failed', e);
    },
  );
}

// ─── listMyAttendance — self-service (T-0181) ──────────────────────────────
//
// Resolves the current user → their `employees` row by encrypted email
// match and returns ONLY their own attendance records. No
// `hr.attendance.read` required — every authenticated user can see
// their own check-ins (mirrors `listMyPayslips`).

export interface MyAttendanceItem {
  id: string;
  shiftCode: string | null;
  checkInAt: Date;
  checkOutAt: Date | null;
  checkInMethod: string;
  isLate: boolean;
  lateMinutes: number;
  workedMinutes: number | null;
  lateForgiven: boolean;
}

export async function listMyAttendance(
  input: { dateFrom?: string; dateTo?: string; limit?: number },
  ctx: AuditContext,
): Promise<Result<MyAttendanceItem[]>> {
  return tryCatch(
    async () => {
      const emp = await resolveEmployeeForUser(ctx.tenantId, ctx.userId);
      if (!emp) return [];
      const empIds = [emp.id];

      const conditions = [
        eq(attendance.tenantId, ctx.tenantId),
        inArray(attendance.employeeId, empIds),
        isNull(attendance.deletedAt),
      ];
      // checkInAt is timestamptz. Bare date strings cast to midnight UTC, not
      // WIB — append +07:00 so PostgreSQL compares in WIB.
      if (input.dateFrom) conditions.push(sql`${attendance.checkInAt} >= ${`${input.dateFrom}T00:00:00+07:00`}`);
      if (input.dateTo) conditions.push(sql`${attendance.checkInAt} < ${`${input.dateTo}T00:00:00+07:00`}::timestamptz + interval '1 day'`);
      const limit = Math.min(input.limit ?? 100, 365);

      const rows = await db
        .select({
          id: attendance.id,
          checkInAt: attendance.checkInAt,
          checkOutAt: attendance.checkOutAt,
          checkInMethod: attendance.checkInMethod,
          isLate: attendance.isLate,
          lateMinutes: attendance.lateMinutes,
          workedMinutes: attendance.workedMinutes,
          shiftCode: attendance.shiftDefinitionCode,
          lateForgiven: attendance.lateForgiven,
        })
        .from(attendance)
        .where(and(...conditions))
        .orderBy(desc(attendance.checkInAt))
        .limit(limit);

      return rows.map((r) => ({
        id: r.id,
        checkInAt: r.checkInAt!,
        checkOutAt: r.checkOutAt,
        checkInMethod: r.checkInMethod,
        isLate: r.isLate,
        lateMinutes: Number(r.lateMinutes),
        workedMinutes: r.workedMinutes ? Number(r.workedMinutes) : null,
        shiftCode: r.shiftCode,
        lateForgiven: r.lateForgiven,
      }));
    },
    (e) => {
      if (e instanceof AppError) return e;
      return AppError.internal('hr.attendance.myListFailed', e);
    },
  );
}
