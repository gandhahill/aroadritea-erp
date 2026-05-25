'use client';

import { Button, Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { createEmployeeAction } from '../actions';

interface EmployeeFormProps {
  assignableRoles?: Array<{ code: string; label: string }>;
  locationOptions?: Array<{ id: string; label: string }>;
}

export function EmployeeForm({ assignableRoles = [], locationOptions = [] }: EmployeeFormProps) {
  const router = useRouter();
  const t = useTranslations('hr.employees');
  const f = useTranslations('hr.employees.form');
  const [state, submitAction, isPending] = useActionState(createEmployeeAction, null);

  useEffect(() => {
    if (!state?.ok || !state.employeeId) return;
    router.push(`/hr/employees/${state.employeeId}`);
    router.refresh();
  }, [router, state]);

  return (
    <form action={submitAction} className="space-y-6">
      {state?.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <Section title={f('identitySection')}>
        <Field label={f('nikOptional')} name="nik" />
        <Field label={f('fullName')} name="name" required />
        <Field label={t('email')} name="email" type="email" required />
        <Field label={f('phone')} name="phone" />
        <Field label={f('address')} name="address" className="md:col-span-2" />
      </Section>

      <Section title={f('employmentSection')}>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{f('location')}</span>
          <Select name="locationId" required defaultValue={locationOptions[0]?.id ?? ''}>
            {locationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </Select>
        </label>
        <Field label={f('position')} name="position" required />
        <Field label={f('department')} name="department" />
        <Field label={f('hireDate')} name="hireDate" type="date" required />
        <Field label={f('probationEnd')} name="probationEndDate" type="date" />
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{f('contractType')}</span>
          <Select name="contractType" required defaultValue="pkwt">
            <option value="pkwt">PKWT</option>
            <option value="pkwtt">PKWTT</option>
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{f('loginScope')}</span>
          <Select name="loginScope" defaultValue="same_location">
            <option value="same_location">{f('loginScopeSameLocation')}</option>
            <option value="global">{f('loginScopeGlobal')}</option>
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{f('workSchedule')}</span>
          <Select name="workSchedule" required defaultValue="fulltime">
            <option value="fulltime">{f('fulltime')}</option>
            <option value="parttime">{f('parttime')}</option>
            <option value="shift">{f('shift')}</option>
          </Select>
        </label>
      </Section>

      <Section title={f('taxBpjsSection')}>
        <Field label={f('npwp')} name="npwp" />
        <Field label={f('bpjsKesehatan')} name="bpjsKesehatan" />
        <Field label={f('bpjsTenagakerja')} name="bpjsTenagakerja" />
        <Field label={f('emergencyName')} name="emergencyContactName" />
        <Field label={f('emergencyPhone')} name="emergencyContactPhone" />
      </Section>

      <Section title={f('loginSection')}>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{f('role')}</span>
          <Select name="roleCode" defaultValue="">
            <option value="">{f('noLogin')}</option>
            {assignableRoles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.label} ({role.code})
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{f('password')}</span>
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            placeholder={f('passwordHint')}
          />
        </label>
        <label className="md:col-span-2 flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            name="requirePasswordChange"
            className="h-4 w-4 rounded border-brand-cream-3 text-brand-red focus:ring-brand-ember-5"
          />
          <span className="text-sm text-brand-ink">{f('requirePasswordChange')}</span>
        </label>
      </Section>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          onClick={() => router.push('/hr/employees')}
          className="rounded-lg "
          variant="secondary"
          size="md"
        >
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="rounded-lg "
          variant="primary"
          size="lg"
        >
          {isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-brand-cream-3 bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-brand-ink">{title}</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  className = '',
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`space-y-1.5 ${className}`}>
      <span className="text-sm font-medium text-brand-ink">
        {label} {required ? <span className="text-brand-red">*</span> : null}
      </span>
      <Input name={name} type={type} required={required} />
    </label>
  );
}
