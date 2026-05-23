'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { updateEmailAction, updatePasswordAction, updateProfileAction } from './actions';
import { MfaSetup } from './mfa-setup';

type ActionResult = { ok: true; message: string } | { ok: false; message: string } | null;

const initialState: ActionResult = null;

export function AccountSettingsClient({
  user,
}: {
  user: { displayName: string; email: string; locale: string };
}) {
  const t = useTranslations('account');
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileAction,
    initialState,
  );
  const [emailState, emailAction, emailPending] = useActionState(updateEmailAction, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updatePasswordAction,
    initialState,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-brand-ink-3">{t('subtitle')}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <form action={profileAction} className="rounded-xl border border-brand-cream-3 bg-card p-5">
          <h2 className="text-base font-semibold text-brand-ink">{t('profile')}</h2>
          <div className="mt-4 space-y-4">
            <Field label={t('displayName')} name="displayName" defaultValue={user.displayName} />
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-brand-ink-3">{t('defaultLanguage')}</span>
              <select
                name="locale"
                defaultValue={user.locale}
                className="w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red"
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
            </label>
          </div>
          <Submit pending={profilePending} label={t('saveProfile')} loading={t('saving')} />
          <Message state={profileState} />
        </form>

        <form action={emailAction} className="rounded-xl border border-brand-cream-3 bg-card p-5">
          <h2 className="text-base font-semibold text-brand-ink">{t('email')}</h2>
          <div className="mt-4 space-y-4">
            <Field label={t('emailAddress')} name="email" defaultValue={user.email} type="email" />
            <Field label={t('currentPassword')} name="currentPassword" type="password" />
          </div>
          <Submit pending={emailPending} label={t('saveEmail')} loading={t('saving')} />
          <Message state={emailState} />
        </form>

        <form
          action={passwordAction}
          className="rounded-xl border border-brand-cream-3 bg-card p-5"
        >
          <h2 className="text-base font-semibold text-brand-ink">{t('password')}</h2>
          <div className="mt-4 space-y-4">
            <Field label={t('currentPassword')} name="currentPassword" type="password" />
            <Field label={t('newPassword')} name="newPassword" type="password" />
            <Field label={t('confirmPassword')} name="confirmPassword" type="password" />
          </div>
          <Submit pending={passwordPending} label={t('savePassword')} loading={t('saving')} />
          <Message state={passwordState} />
        </form>

        <MfaSetup />
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-brand-ink-3">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-brand-cream-3 bg-brand-cream px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red"
      />
    </label>
  );
}

function Submit({ pending, label, loading }: { pending: boolean; label: string; loading: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
    >
      {pending ? loading : label}
    </button>
  );
}

function Message({ state }: { state: ActionResult }) {
  const t = useTranslations();
  if (!state) return null;
  return (
    <p
      className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
        state.ok ? 'bg-brand-jade/10 text-brand-jade' : 'bg-rose-50 text-rose-700'
      }`}
    >
      {t(state.message)}
    </p>
  );
}
