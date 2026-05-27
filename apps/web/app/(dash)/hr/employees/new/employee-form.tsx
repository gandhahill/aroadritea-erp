'use client';

import type { EmployeeDetailResult } from '@erp/services/hr';
import { Button, Input, Select } from '@erp/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { createEmployeeAction, updateEmployeeAction } from '../actions';

interface EmployeeFormProps {
  assignableRoles?: Array<{ code: string; label: string }>;
  locationOptions?: Array<{ id: string; label: string }>;
  employee?: EmployeeDetailResult;
}

export function EmployeeForm({
  assignableRoles = [],
  locationOptions = [],
  employee,
}: EmployeeFormProps) {
  const router = useRouter();
  const t = useTranslations('hr.employees');
  const f = useTranslations('hr.employees.form');
  const isEdit = Boolean(employee);
  const action = isEdit ? updateEmployeeAction : createEmployeeAction;
  const [state, submitAction, isPending] = useActionState(action, null);

  useEffect(() => {
    if (!state?.ok || !state.employeeId) return;
    router.push(`/hr/employees/${state.employeeId}`);
    router.refresh();
  }, [router, state]);

  return (
    <form action={submitAction} className="space-y-6">
      {employee ? (
        <>
          <input type="hidden" name="employeeId" value={employee.id} />
          <input type="hidden" name="version" value={employee.version} />
        </>
      ) : null}

      {state?.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <Section title={f('identitySection')}>
        <Field label={f('nikOptional')} name="nik" defaultValue={employee?.nik ?? ''} />
        <Field label={f('fullName')} name="name" required defaultValue={employee?.name ?? ''} />
        <Field
          label={t('email')}
          name="email"
          type="email"
          required
          defaultValue={employee?.email ?? ''}
        />
        <Field label={f('phone')} name="phone" defaultValue={employee?.phone ?? ''} />
        <Field
          label={f('address')}
          name="address"
          className="md:col-span-2"
          defaultValue={employee?.address ?? ''}
        />
      </Section>

      <Section title={f('employmentSection')}>
        <label htmlFor="locationId" className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{f('location')}</span>
          <Select
            id="locationId"
            name="locationId"
            required
            defaultValue={employee?.locationId ?? locationOptions[0]?.id ?? ''}
          >
            {locationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </Select>
        </label>
        <Field
          label={f('position')}
          name="position"
          required
          defaultValue={employee?.position ?? ''}
        />
        <Field
          label={f('department')}
          name="department"
          defaultValue={employee?.department ?? ''}
        />
        {!isEdit ? (
          <>
            <Field label={f('hireDate')} name="hireDate" type="date" required />
            <Field label={f('probationEnd')} name="probationEndDate" type="date" />
          </>
        ) : null}
        <label htmlFor="contractType" className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{f('contractType')}</span>
          <Select
            id="contractType"
            name="contractType"
            required
            defaultValue={employee?.contractType ?? 'pkwt'}
          >
            <option value="pkwt">PKWT</option>
            <option value="pkwtt">PKWTT</option>
          </Select>
        </label>
        {!isEdit ? (
          <label htmlFor="loginScope" className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{f('loginScope')}</span>
            <Select id="loginScope" name="loginScope" defaultValue="same_location">
              <option value="same_location">{f('loginScopeSameLocation')}</option>
              <option value="global">{f('loginScopeGlobal')}</option>
            </Select>
          </label>
        ) : null}
        <label htmlFor="workSchedule" className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">{f('workSchedule')}</span>
          <Select
            id="workSchedule"
            name="workSchedule"
            required
            defaultValue={employee?.workSchedule ?? 'fulltime'}
          >
            <option value="fulltime">{f('fulltime')}</option>
            <option value="parttime">{f('parttime')}</option>
            <option value="shift">{f('shift')}</option>
          </Select>
        </label>
        {isEdit ? (
          <label htmlFor="status" className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{t('status')}</span>
            <Select
              id="status"
              name="status"
              required
              defaultValue={employee?.status ?? 'probation'}
            >
              <option value="probation">{t('statusProbation')}</option>
              <option value="active">{t('statusActive')}</option>
              <option value="on_leave">{t('statusOnLeave')}</option>
              <option value="terminated">{t('statusTerminated')}</option>
            </Select>
          </label>
        ) : null}
      </Section>

      <Section title={f('taxBpjsSection')}>
        <Field label={f('npwp')} name="npwp" defaultValue={employee?.npwp ?? ''} />
        <Field
          label={f('bpjsKesehatan')}
          name="bpjsKesehatan"
          defaultValue={employee?.bpjsKesehatan ?? ''}
        />
        <Field
          label={f('bpjsTenagakerja')}
          name="bpjsTenagakerja"
          defaultValue={employee?.bpjsTenagakerja ?? ''}
        />
        <Field
          label={f('emergencyName')}
          name="emergencyContactName"
          defaultValue={employee?.emergencyContactName ?? ''}
        />
        <Field
          label={f('emergencyPhone')}
          name="emergencyContactPhone"
          defaultValue={employee?.emergencyContactPhone ?? ''}
        />
      </Section>

      {!isEdit ? (
        <Section title={f('loginSection')}>
          <label htmlFor="roleCode" className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{f('role')}</span>
            <Select id="roleCode" name="roleCode" defaultValue="">
              <option value="">{f('noLogin')}</option>
              {assignableRoles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.label} ({role.code})
                </option>
              ))}
            </Select>
          </label>
          <label htmlFor="password" className="space-y-1.5">
            <span className="text-sm font-medium text-brand-ink">{f('password')}</span>
            <Input
              id="password"
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
      ) : null}

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
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  className?: string;
  defaultValue?: string;
}) {
  return (
    <label htmlFor={name} className={`space-y-1.5 ${className}`}>
      <span className="text-sm font-medium text-brand-ink">
        {label} {required ? <span className="text-brand-red">*</span> : null}
      </span>
      <Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} />
    </label>
  );
}
