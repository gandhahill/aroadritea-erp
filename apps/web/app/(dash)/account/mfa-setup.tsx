'use client';

import { authClient } from '@/lib/auth-client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Input } from "@erp/ui";

export function MfaSetup() {
  const t = useTranslations('account.mfa');
  const [password, setPassword] = useState('');
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);

  // In a real implementation we would also fetch whether MFA is currently enabled.
  // We can assume we don't have `useSession` data here perfectly, so we just offer "Enable" for now.

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const result = await authClient.twoFactor.enable({ password });
      if (result.error) {
        setError(result.error.message || 'Error');
      } else if (result.data) {
        // Better auth usually returns { totpURI: string }
        setTotpUri((result.data as any).totpURI || '');
        setSecret((result.data as any).totpSecret || 'Unknown Secret');
        setEnabled(true);
      }
    } catch (err) {
      setError('Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-cream-3 bg-card p-5">
      <h2 className="text-base font-semibold text-brand-ink">{t('title') || 'Two-Factor Authentication'}</h2>
      <p className="text-xs text-brand-ink-3 mb-4">{t('subtitle') || 'Secure your account with TOTP'}</p>
      
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!enabled && !totpUri && (
        <form onSubmit={handleEnable} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-brand-ink-3">{t('password') || 'Current Password'}</span>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red"
            />
          </label>
          <Button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60" variant="primary" size="md"
          >
            {loading ? (t('enabling') || 'Enabling...') : (t('enable') || 'Enable 2FA')}
          </Button>
        </form>
      )}

      {totpUri && (
        <div className="space-y-4">
          <div className="p-4 bg-brand-cream-1 rounded-lg border border-brand-cream-3">
            <p className="text-sm font-medium text-brand-ink mb-2">{t('scanTitle') || 'Setup Instructions'}</p>
            <p className="text-xs text-brand-ink-3 mb-4">{t('scanSubtitle') || 'Add this URI to your authenticator app.'}</p>
            <div className="text-xs break-all bg-white p-2 rounded border border-gray-200">
              {totpUri}
            </div>
            {secret && (
               <p className="text-xs text-brand-ink-3 mt-4">Secret: {secret}</p>
            )}
          </div>
          <Button
            onClick={() => {
              setTotpUri(null);
              setPassword('');
            }}
            className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-cream-1" variant="secondary" size="md"
          >
            {t('done') || 'Done'}
          </Button>
        </div>
      )}
    </div>
  );
}
