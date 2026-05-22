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

import type { GpsData } from '@erp/services/hr';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { serverCheckIn } from './actions';

interface Props {
  // userId / tenantId no longer flow through the client — serverCheckIn
  // resolves session-side. Kept on the prop type so the parent server
  // component can keep its current shape without churn.
  userId?: string;
  tenantId?: string;
  locationId: string;
  employeeId: string;
  shifts: Array<{ id: string; label: string; time: string }>;
}

type GpsStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error' | 'low_accuracy';

interface GpsState {
  status: GpsStatus;
  data: GpsData | null;
  error: string | null;
  watchId: number | null;
}

export function CheckInClient({ locationId, employeeId, shifts }: Props) {
  const t = useTranslations('hr.attendance.checkInPage');
  const attendanceT = useTranslations('hr.attendance');
  const locale = useLocale();
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
  const displayLocale = useMemo(() => {
    if (locale === 'en') return 'en-US';
    if (locale === 'zh') return 'zh-CN';
    return 'id-ID';
  }, [locale]);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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
        const status: GpsStatus = pos.coords.accuracy > 200 ? 'low_accuracy' : 'granted';
        setGps((s) => ({ ...s, status, data }));
      },
      (err) => {
        const errorMsg =
          err.code === err.PERMISSION_DENIED ? t('messages.locationPermissionDenied') : err.message;
        setGps((s) => ({ ...s, status: 'denied', error: errorMsg }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
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
      const msg = res.error?.message ?? t('messages.checkInFailed');
      setResult({ ok: false, message: msg });
    }
  };
  const canCheckIn =
    (gps.status === 'granted' || gps.status === 'low_accuracy') &&
    !submitting &&
    !!employeeId &&
    !!selectedShift;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand-ink">{attendanceT('checkIn')}</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            {currentTime.toLocaleDateString(displayLocale, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <p className="mt-0.5 font-mono text-3xl font-bold text-brand-ember-5">
            {currentTime.toLocaleTimeString(displayLocale, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
        </div>

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
          {gps.error && <p className="text-xs text-rose-500">{gps.error}</p>}
          {gps.status === 'denied' && (
            <button onClick={requestGps} className="mt-2 text-xs text-brand-ember-5 underline">
              {t('actions.requestPermissionAgain')}
            </button>
          )}
        </div>

        {/* Shift selection */}
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

        {/* Check In button */}
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

        {!employeeId && (
          <p className="text-center text-xs text-rose-500">{t('messages.noEmployeeLinked')}</p>
        )}
      </div>
    </div>
  );
}
