/**
 * HR Check-In Client â€” mobile-friendly GPS check-in.
 *
 * Workflow:
 * 1. Request geolocation permission
 * 2. Show current GPS (lat/lng/accuracy)
 * 3. Select shift (defaults to today's expected)
 * 4. Tap "Check In" â†’ server action â†’ success/error
 */

'use client';

import { PageHeader } from '@/components/page-header';
import type { FaceTemplatePayload, GpsData } from '@erp/services/hr';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { serverCheckIn, serverCheckOut } from './actions';

interface LocationGps {
  lat: number;
  lng: number;
  radiusM: number;
  name: string;
}

interface OpenAttendance {
  id: string;
  checkInAt: string;
  shiftCode: string | null;
}

interface Props {
  userId?: string;
  tenantId?: string;
  locationId: string;
  employeeId: string;
  shifts: Array<{ id: string; label: string; time: string }>;
  locationGps?: LocationGps | null;
  openAttendance?: OpenAttendance | null;
  faceVerification?: { hasTemplate: boolean };
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type GpsStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error' | 'low_accuracy';
type CameraStatus = 'idle' | 'requesting' | 'ready' | 'capturing' | 'captured' | 'denied' | 'error';

interface GpsState {
  status: GpsStatus;
  data: GpsData | null;
  error: string | null;
  watchId: number | null;
}

const GPS_LOW_ACCURACY_THRESHOLD_M = 200;
const GPS_HARD_ACCURACY_LIMIT_M = 500;
const GPS_RADIUS_BUFFER_M = 25;
const FACE_TEMPLATE_SIZE = 16;

function effectiveAttendanceRadiusM(radiusM: number, accuracyM: number): number {
  const safeRadius = Number.isFinite(radiusM) && radiusM > 0 ? radiusM : 150;
  const safeAccuracy = Number.isFinite(accuracyM) && accuracyM > 0 ? accuracyM : 0;
  return safeRadius + Math.min(safeAccuracy, GPS_HARD_ACCURACY_LIMIT_M) + GPS_RADIUS_BUFFER_M;
}

function toHex(bits: number[]): string {
  let out = '';
  for (let i = 0; i < bits.length; i += 4) {
    const nibble =
      ((bits[i] ?? 0) << 3) |
      ((bits[i + 1] ?? 0) << 2) |
      ((bits[i + 2] ?? 0) << 1) |
      (bits[i + 3] ?? 0);
    out += nibble.toString(16);
  }
  return out;
}

async function detectFaceIfSupported(video: HTMLVideoElement): Promise<boolean | undefined> {
  const browserWindow = window as unknown as {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (source: HTMLVideoElement) => Promise<Array<unknown>>;
    };
  };
  if (!browserWindow.FaceDetector) return undefined;
  try {
    const detector = new browserWindow.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    const faces = await detector.detect(video);
    return faces.length > 0;
  } catch {
    return undefined;
  }
}

async function buildFaceTemplate(video: HTMLVideoElement): Promise<FaceTemplatePayload> {
  const canvas = document.createElement('canvas');
  canvas.width = FACE_TEMPLATE_SIZE;
  canvas.height = FACE_TEMPLATE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas_unavailable');

  ctx.drawImage(video, 0, 0, FACE_TEMPLATE_SIZE, FACE_TEMPLATE_SIZE);
  const image = ctx.getImageData(0, 0, FACE_TEMPLATE_SIZE, FACE_TEMPLATE_SIZE);
  const values: number[] = [];
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i] ?? 0;
    const g = image.data[i + 1] ?? 0;
    const b = image.data[i + 2] ?? 0;
    values.push(Math.round(0.299 * r + 0.587 * g + 0.114 * b));
  }

  const avg = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(1, values.length);
  const contrast = Math.sqrt(variance);
  const brightnessScore = Math.max(0, 100 - Math.abs(avg - 128));
  const quality = Math.max(0, Math.min(100, Math.round(contrast * 2 + brightnessScore * 0.35)));
  const faceDetected = await detectFaceIfSupported(video);

  return {
    version: 'ahash-16x16-v1',
    hash: toHex(values.map((value) => (value >= avg ? 1 : 0))),
    quality,
    faceDetected,
    capturedAt: new Date().toISOString(),
  };
}

export function CheckInClient({
  locationId,
  employeeId,
  shifts,
  locationGps,
  openAttendance,
  faceVerification,
}: Props) {
  const isCheckOutMode = !!openAttendance;
  const hasFaceTemplate = faceVerification?.hasTemplate ?? false;
  const t = useTranslations('hr.attendance.checkInPage');
  const attendanceT = useTranslations('hr.attendance');
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [gps, setGps] = useState<GpsState>({
    status: 'idle',
    data: null,
    error: null,
    watchId: null,
  });
  const [selectedShift, setSelectedShift] = useState(shifts[0]?.id ?? '');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceTemplate, setFaceTemplate] = useState<FaceTemplatePayload | null>(null);
  const displayLocale = useMemo(() => {
    if (locale === 'en') return 'en-GB';
    if (locale === 'zh') return 'zh-CN';
    return 'id-ID';
  }, [locale]);

  // Distance from user GPS to configured outlet location
  const locationCheck = useMemo(() => {
    if (!locationGps || !gps.data) return null;
    const distanceM = haversineM(gps.data.lat, gps.data.lng, locationGps.lat, locationGps.lng);
    const effectiveRadiusM = effectiveAttendanceRadiusM(locationGps.radiusM, gps.data.accuracy_m);
    return {
      distanceM: Math.round(distanceM),
      radiusM: locationGps.radiusM,
      accuracyM: Math.round(gps.data.accuracy_m),
      effectiveRadiusM: Math.round(effectiveRadiusM),
      withinRadius: distanceM <= effectiveRadiusM,
      locationName: locationGps.name,
    };
  }, [locationGps, gps.data]);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('error');
      setCameraError(t('face.cameraUnsupported'));
      return;
    }

    setCameraStatus('requesting');
    setCameraError(null);
    setFaceTemplate(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus('ready');
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      setCameraStatus(name === 'NotAllowedError' ? 'denied' : 'error');
      setCameraError(
        name === 'NotAllowedError' ? t('face.permissionDenied') : t('face.cameraUnavailable'),
      );
    }
  }, [t]);

  const captureFace = useCallback(async () => {
    if (!videoRef.current) return;

    setCameraStatus('capturing');
    setCameraError(null);
    try {
      const template = await buildFaceTemplate(videoRef.current);
      if (template.faceDetected === false) {
        setCameraStatus('ready');
        setCameraError(t('face.notDetected'));
        return;
      }
      setFaceTemplate(template);
      setCameraStatus('captured');
      stopCamera();
    } catch {
      setCameraStatus('error');
      setCameraError(t('face.captureFailed'));
    }
  }, [stopCamera, t]);

  // Request GPS on mount
  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGps((s) => ({
        ...s,
        status: 'error',
        error: t('messages.geolocationUnsupported'),
      }));
      return;
    }

    setGps((s) => ({ ...s, status: 'requesting' }));

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const data: GpsData = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          source: 'geolocation_api',
        };
        setGps((s) => {
          const bestData =
            !s.data || data.accuracy_m <= s.data.accuracy_m ? data : s.data;
          const status: GpsStatus =
            bestData.accuracy_m > GPS_LOW_ACCURACY_THRESHOLD_M ? 'low_accuracy' : 'granted';
          return { ...s, status, data: bestData };
        });
      },
      (err) => {
        let errorMsg = t('messages.locationUnavailable');
        if (err.code === err.PERMISSION_DENIED) {
          errorMsg = t('messages.locationPermissionDenied');
        } else if (err.code === err.TIMEOUT) {
          errorMsg = t('messages.locationTimeout');
        }
        setGps((s) => ({
          ...s,
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
          error: errorMsg,
        }));
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 },
    );

    setGps((s) => ({ ...s, watchId }));
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    const cleanup = requestGps();
    return () => {
      cleanup?.();
      if (gps.watchId !== null) navigator.geolocation.clearWatch(gps.watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckIn = async () => {
    if (!employeeId) {
      setResult({
        ok: false,
        message: t('messages.employeeMissing'),
      });
      return;
    }

    setSubmitting(true);
    setResult(null);

    // ctx is no longer passed from the client — serverCheckIn resolves
    // the session itself. We still derive gps data here because the
    // browser geolocation API is the source of truth.
    const gpsData = gps.data
      ? { ...gps.data, source: gps.data.source ?? 'geolocation_api' }
      : undefined;

    const res = await serverCheckIn({
      employeeId,
      shiftDefinitionId: selectedShift || undefined,
      method: 'gps',
      gpsData,
      faceTemplate: faceTemplate ?? undefined,
      enrollFace: !hasFaceTemplate,
    });

    setSubmitting(false);

    if (res.ok) {
      const data = res.value;
      if (data.isLate) {
        setResult({
          ok: true,
          message: t('messages.checkedInLate', { minutes: data.lateMinutes }),
        });
      } else {
        setResult({ ok: true, message: t('messages.checkedInOnTime') });
      }
    } else {
      // messageKey is e.g. 'hr.attendance.outsideLocationRadius' — extract
      // the last segment to look up the translated string under hr.attendance.*
      const key = res.error?.message ?? '';
      const shortKey = key.includes('.') ? key.split('.').pop()! : '';
      const translated = shortKey ? attendanceT(shortKey, { defaultValue: '' }) : '';
      const details = res.error?.details as
        | {
            distanceM?: number;
            radiusM?: number;
            accuracyM?: number;
            effectiveRadiusM?: number;
            accuracy?: number;
            maxAccuracy?: number;
            quality?: number;
            minQuality?: number;
            score?: number;
            threshold?: number;
          }
        | undefined;
      let detailMessage = '';
      if (
        typeof details?.distanceM === 'number' &&
        typeof details.radiusM === 'number' &&
        typeof details.effectiveRadiusM === 'number'
      ) {
        detailMessage = t('messages.gpsDistanceDetail', {
          distance: details.distanceM,
          radius: details.radiusM,
          effectiveRadius: details.effectiveRadiusM,
          accuracy: details.accuracyM ?? 0,
        });
      } else if (typeof details?.accuracy === 'number') {
        detailMessage = t('messages.gpsAccuracyDetail', {
          accuracy: Math.round(details.accuracy),
          maxAccuracy: details.maxAccuracy ?? GPS_HARD_ACCURACY_LIMIT_M,
        });
      } else if (typeof details?.quality === 'number') {
        detailMessage = t('face.qualityDetail', {
          quality: Math.round(details.quality),
          minQuality: details.minQuality ?? 20,
        });
      } else if (typeof details?.score === 'number') {
        detailMessage = t('face.matchDetail', {
          score: Math.round(details.score),
          threshold: details.threshold ?? 62,
        });
      }
      const msg = [translated || t('messages.checkInFailed'), detailMessage]
        .filter(Boolean)
        .join(' ');
      setResult({ ok: false, message: msg });
    }
  };
  const handleCheckOut = async () => {
    if (!openAttendance) return;
    setSubmitting(true);
    setResult(null);

    const gpsData = gps.data
      ? { ...gps.data, source: gps.data.source ?? 'geolocation_api' }
      : undefined;

    const res = await serverCheckOut({
      attendanceId: openAttendance.id,
      gpsData,
    });

    setSubmitting(false);

    if (res.ok) {
      const data = res.value;
      const workedH = data.workedMinutes ? Math.floor(data.workedMinutes / 60) : 0;
      const workedM = data.workedMinutes ? data.workedMinutes % 60 : 0;
      setResult({
        ok: true,
        message: t('messages.checkedOut', {
          hours: workedH,
          minutes: workedM,
          defaultValue: `Check-out recorded. Worked ${workedH}h ${workedM}m.`,
        }),
      });
    } else {
      const key = res.error?.message ?? '';
      const shortKey = key.includes('.') ? key.split('.').pop()! : '';
      const translated = shortKey ? attendanceT(shortKey, { defaultValue: '' }) : '';
      setResult({
        ok: false,
        message: translated || t('messages.checkOutFailed', { defaultValue: 'Check-out failed. Try again.' }),
      });
    }
  };

  const gpsReady =
    (gps.status === 'granted' || gps.status === 'low_accuracy') &&
    (gps.data?.accuracy_m ?? Number.POSITIVE_INFINITY) <= GPS_HARD_ACCURACY_LIMIT_M;

  const canCheckIn =
    gpsReady &&
    !submitting &&
    !!employeeId &&
    !!selectedShift &&
    !!faceTemplate &&
    !isCheckOutMode;

  const canCheckOut = gpsReady && !submitting && isCheckOutMode;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <PageHeader
          title={<>{isCheckOutMode ? attendanceT('checkOut') : attendanceT('checkIn')}</>}
          description={
            <>
              {currentTime.toLocaleTimeString(displayLocale, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </>
          }
        />

        {/* Check-out mode: show check-in info */}
        {isCheckOutMode && openAttendance && (
          <div className="rounded-xl border border-brand-jade/30 bg-brand-jade/5 p-4">
            <p className="text-sm font-medium text-brand-jade">
              {t('messages.alreadyCheckedIn', {
                time: new Date(openAttendance.checkInAt).toLocaleTimeString(displayLocale, {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                defaultValue: `Checked in at ${new Date(openAttendance.checkInAt).toLocaleTimeString(displayLocale, { hour: '2-digit', minute: '2-digit' })}`,
              })}
            </p>
            {openAttendance.shiftCode && (
              <p className="mt-0.5 text-xs text-brand-ink-3">
                {attendanceT('shift')}: {openAttendance.shiftCode}
              </p>
            )}
          </div>
        )}

        {/* GPS Status */}
        <div className="rounded-xl border border-brand-cream-3 bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-brand-ink">{t('location')}</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                gps.status === 'granted'
                  ? 'bg-brand-jade/10 text-brand-jade'
                  : gps.status === 'low_accuracy'
                    ? 'bg-brand-gold/10 text-brand-gold'
                    : gps.status === 'requesting'
                      ? 'bg-brand-cream-2 text-brand-ink-2'
                      : 'bg-rose-50 text-rose-500'
              }`}
            >
              {gps.status === 'granted'
                ? t('status.accurate')
                : gps.status === 'low_accuracy'
                  ? t('status.lowAccuracy')
                  : gps.status === 'requesting'
                    ? t('status.gettingLocation')
                    : gps.status === 'denied'
                      ? t('status.denied')
                      : gps.status === 'error'
                        ? t('status.error')
                        : t('status.notStarted')}
            </span>
          </div>
          {gps.data && (
            <p className="font-mono text-xs text-brand-ink-3">
              {gps.data.lat.toFixed(6)}, {gps.data.lng.toFixed(6)} / +/-
              {Math.round(gps.data.accuracy_m)}m
            </p>
          )}
          {gps.data && gps.data.accuracy_m > GPS_HARD_ACCURACY_LIMIT_M && (
            <p className="mt-1 text-xs text-amber-700">
              {t('messages.gpsAccuracyDetail', {
                accuracy: Math.round(gps.data.accuracy_m),
                maxAccuracy: GPS_HARD_ACCURACY_LIMIT_M,
              })}
            </p>
          )}
          {gps.error && <p className="text-xs text-rose-500">{gps.error}</p>}
          {gps.status === 'denied' && (
            <button onClick={requestGps} className="mt-2 text-xs text-brand-ember-5 underline">
              {t('actions.requestPermissionAgain')}
            </button>
          )}
        </div>

        {/* Location detection status */}
        {locationCheck && (
          <div
            className={`flex items-center gap-3 rounded-xl border p-4 ${
              locationCheck.withinRadius
                ? 'border-brand-jade/30 bg-brand-jade/5'
                : 'border-rose-200 bg-rose-50'
            }`}
          >
            <span className="text-brand-ink">
              {locationCheck.withinRadius ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-brand-jade"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-rose-500"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </span>
            <div className="flex-1">
              <p
                className={`text-sm font-semibold ${
                  locationCheck.withinRadius ? 'text-brand-jade' : 'text-rose-600'
                }`}
              >
                {locationCheck.withinRadius
                  ? t('status.withinRadius')
                  : t('status.outsideRadius')}
              </p>
              <p className="text-xs text-brand-ink-3">
                {t('status.distanceInfoWithAccuracy', {
                  distance: locationCheck.distanceM,
                  radius: locationCheck.radiusM,
                  effectiveRadius: locationCheck.effectiveRadiusM,
                  accuracy: locationCheck.accuracyM,
                  location: locationCheck.locationName,
                })}
              </p>
            </div>
          </div>
        )}
        {!locationGps && gps.data && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-700">
              {t('status.gpsNotConfigured')}
            </p>
          </div>
        )}

        {/* Shift selection — only for check-in */}
        {!isCheckOutMode && (
          <div className="rounded-xl border border-brand-cream-3 bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-brand-ink">
                  {hasFaceTemplate ? t('face.verifyTitle') : t('face.enrollTitle')}
                </p>
                <p className="mt-1 text-xs leading-5 text-brand-ink-3">
                  {hasFaceTemplate ? t('face.verifyDescription') : t('face.enrollDescription')}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  faceTemplate
                    ? 'bg-brand-jade/10 text-brand-jade'
                    : cameraStatus === 'ready' || cameraStatus === 'capturing'
                      ? 'bg-brand-gold/10 text-brand-gold'
                      : 'bg-brand-cream-2 text-brand-ink-3'
                }`}
              >
                {faceTemplate
                  ? t('face.statusCaptured')
                  : cameraStatus === 'ready'
                    ? t('face.statusReady')
                    : cameraStatus === 'requesting'
                      ? t('face.statusRequesting')
                      : t('face.statusNeeded')}
              </span>
            </div>

            {(cameraStatus === 'requesting' ||
              cameraStatus === 'ready' ||
              cameraStatus === 'capturing') && (
              <div className="overflow-hidden rounded-lg border border-brand-cream-3 bg-brand-ink">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
            )}

            {faceTemplate && (
              <div className="rounded-lg border border-brand-jade/30 bg-brand-jade/5 px-3 py-2">
                <p className="text-xs font-medium text-brand-jade">
                  {t('face.captured', { quality: faceTemplate.quality })}
                </p>
              </div>
            )}

            {cameraError && (
              <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {cameraError}
              </p>
            )}

            <p className="mt-3 text-xs leading-5 text-brand-ink-3">{t('face.privacyNote')}</p>

            <div className="mt-3 flex gap-2">
              {cameraStatus === 'ready' || cameraStatus === 'capturing' ? (
                <button
                  type="button"
                  onClick={captureFace}
                  disabled={cameraStatus === 'capturing'}
                  className="flex-1 rounded-lg bg-brand-ember-5 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ember-6 disabled:opacity-60"
                >
                  {cameraStatus === 'capturing' ? t('face.capturing') : t('face.capture')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={cameraStatus === 'requesting'}
                  className="flex-1 rounded-lg bg-brand-ink px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ink-2 disabled:opacity-60"
                >
                  {cameraStatus === 'requesting' ? t('face.openingCamera') : t('face.openCamera')}
                </button>
              )}
              {faceTemplate && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="rounded-lg border border-brand-cream-3 px-3 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-2"
                >
                  {t('face.retake')}
                </button>
              )}
            </div>
          </div>
        )}

        {!isCheckOutMode && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-brand-ink">{attendanceT('shift')}</span>
            <div className="grid grid-cols-2 gap-2">
              {shifts.map((shift) => (
                <button
                  key={shift.id}
                  onClick={() => setSelectedShift(shift.id)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    selectedShift === shift.id
                      ? 'border-brand-ember-5 bg-brand-ember-5/10 text-brand-ember-5'
                      : 'border-brand-cream-3 bg-card text-brand-ink hover:border-brand-ember-5/50'
                  }`}
                >
                  <div>{shift.label}</div>
                  <div className="mt-0.5 text-xs text-brand-ink-3">{shift.time}</div>
                </button>
              ))}
            </div>
            {shifts.length === 0 && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {t('messages.noShift')}
              </p>
            )}
          </div>
        )}

        {/* Result message */}
        {result && (
          <div
            className={`rounded-lg border px-4 py-3 text-center text-sm font-medium ${
              result.ok
                ? 'border-brand-jade/30 bg-brand-jade/10 text-brand-jade'
                : 'border-rose-200 bg-rose-50 text-rose-600'
            }`}
          >
            {result.message}
          </div>
        )}

        {/* Action button */}
        {isCheckOutMode ? (
          <button
            onClick={handleCheckOut}
            disabled={!canCheckOut || submitting}
            className={`w-full rounded-2xl py-5 text-lg font-bold transition-all ${
              canCheckOut
                ? 'bg-brand-jade text-white shadow-lg shadow-brand-jade/30 hover:brightness-110 active:scale-95'
                : 'bg-brand-cream-2 text-brand-ink-3 cursor-not-allowed'
            }`}
          >
            {submitting
              ? t('actions.checkingOut', { defaultValue: 'Processing...' })
              : attendanceT('checkOut')}
          </button>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={!canCheckIn || submitting}
            className={`w-full rounded-2xl py-5 text-lg font-bold transition-all ${
              canCheckIn
                ? 'bg-brand-ember-5 text-white shadow-lg shadow-brand-ember-5/30 hover:bg-brand-ember-6 active:scale-95'
                : 'bg-brand-cream-2 text-brand-ink-3 cursor-not-allowed'
            }`}
          >
            {submitting ? t('actions.checkingIn') : attendanceT('checkIn')}
          </button>
        )}

        {!employeeId && (
          <p className="text-center text-xs text-rose-500">{t('messages.noEmployeeLinked')}</p>
        )}
      </div>
    </div>
  );
}
