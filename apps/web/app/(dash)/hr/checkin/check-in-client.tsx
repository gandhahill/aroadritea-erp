/**
 * HR Check-In Client — mobile-friendly GPS check-in.
 *
 * Workflow:
 * 1. Request geolocation permission
 * 2. Show current GPS (lat/lng/accuracy)
 * 3. Select shift (defaults to today's expected)
 * 4. Tap "Check In" → server action → success/error
 */

'use client';

import type { GpsData } from '@erp/services/hr';
import { useCallback, useEffect, useState } from 'react';
import { serverCheckIn } from './actions';

interface Props {
  userId: string;
  tenantId: string;
  locationId: string;
  employeeId: string;
}

type GpsStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error' | 'low_accuracy';

interface GpsState {
  status: GpsStatus;
  data: GpsData | null;
  error: string | null;
  watchId: number | null;
}

export function CheckInClient({ userId, tenantId, locationId, employeeId }: Props) {
  const [gps, setGps] = useState<GpsState>({
    status: 'idle',
    data: null,
    error: null,
    watchId: null,
  });
  const [selectedShift, setSelectedShift] = useState('shift-pagi');
  const [method, setMethod] = useState<'gps' | 'qr_scan'>('gps');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

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
        error: 'Geolocation not supported by this browser.',
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
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please enable location access.'
            : err.message;
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
        message: 'Employee ID not found. Please log in with your employee account.',
      });
      return;
    }

    setSubmitting(true);
    setResult(null);

    const ctx = {
      userId,
      tenantId,
      locationId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };
    const gpsData =
      method === 'gps' && gps.data
        ? { ...gps.data, source: gps.data.source ?? 'geolocation_api' }
        : undefined;

    const res = await serverCheckIn(
      {
        employeeId,
        shiftDefinitionId: selectedShift || undefined,
        method,
        gpsData,
      },
      ctx,
    );

    setSubmitting(false);

    if (res.ok) {
      const data = res.value;
      if (data.isLate) {
        setResult({ ok: true, message: `Checked in! Late: +${data.lateMinutes} minutes` });
      } else {
        setResult({ ok: true, message: 'Checked in successfully. On time!' });
      }
    } else {
      const msg = res.error?.message ?? 'Check-in failed. Please try again.';
      setResult({ ok: false, message: msg });
    }
  };

  const SHIFTS = [
    { id: 'shift-pagi', label: 'Pagi', time: '09:30 – 17:30' },
    { id: 'shift-siang', label: 'Siang', time: '14:30 – 22:30' },
  ];

  const canCheckIn =
    (method === 'qr_scan' || gps.status === 'granted' || gps.status === 'low_accuracy') &&
    !submitting &&
    !!employeeId;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-brand-ink">Check In</h1>
          <p className="mt-1 text-sm text-brand-ink-3">
            {currentTime.toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <p className="mt-0.5 font-mono text-3xl font-bold text-brand-ember-5">
            {currentTime.toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
        </div>

        {/* GPS Status */}
        <div className="rounded-xl border border-brand-cream-3 bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-brand-ink">Location</span>
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
                ? '● Accurate'
                : gps.status === 'low_accuracy'
                  ? '● Low accuracy'
                  : gps.status === 'requesting'
                    ? '○ Getting location...'
                    : gps.status === 'denied'
                      ? '✕ Denied'
                      : gps.status === 'error'
                        ? '✕ Error'
                        : '○ Not started'}
            </span>
          </div>
          {gps.data && (
            <p className="font-mono text-xs text-brand-ink-3">
              {gps.data.lat.toFixed(6)}, {gps.data.lng.toFixed(6)} · ±
              {Math.round(gps.data.accuracy_m)}m
            </p>
          )}
          {gps.error && <p className="text-xs text-rose-500">{gps.error}</p>}
          {gps.status === 'denied' && (
            <button onClick={requestGps} className="mt-2 text-xs text-brand-ember-5 underline">
              Request permission again
            </button>
          )}
        </div>

        {/* Method toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMethod('gps')}
            className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              method === 'gps'
                ? 'border-brand-ember-5 bg-brand-ember-5 text-white'
                : 'border-brand-cream-3 bg-card text-brand-ink'
            }`}
          >
            GPS
          </button>
          <button
            onClick={() => setMethod('qr_scan')}
            className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              method === 'qr_scan'
                ? 'border-brand-ember-5 bg-brand-ember-5 text-white'
                : 'border-brand-cream-3 bg-card text-brand-ink'
            }`}
          >
            QR Scan
          </button>
        </div>

        {/* Shift selection */}
        <div className="space-y-2">
          <span className="text-sm font-medium text-brand-ink">Shift</span>
          <div className="grid grid-cols-2 gap-2">
            {SHIFTS.map((shift) => (
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
          {submitting ? 'Checking in...' : 'CHECK IN'}
        </button>

        {!employeeId && (
          <p className="text-center text-xs text-rose-500">
            No employee account linked to this user. Contact administrator.
          </p>
        )}
      </div>
    </div>
  );
}
