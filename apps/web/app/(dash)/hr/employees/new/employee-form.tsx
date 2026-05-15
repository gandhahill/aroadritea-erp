'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { createEmployeeAction } from '../actions';

const INPUT =
  'w-full rounded-lg border border-brand-cream-3 bg-card px-3 py-2 text-sm text-brand-ink shadow-sm transition-colors placeholder:text-brand-ink-3/60 focus:border-brand-ember-5 focus:outline-none focus:ring-1 focus:ring-brand-ember-5';

export function EmployeeForm() {
  const router = useRouter();
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

      <Section title="Identitas karyawan">
        <Field label="NIK / KTP" name="nik" required />
        <Field label="Nama lengkap" name="name" required />
        <Field label="Email" name="email" type="email" required />
        <Field label="Nomor telepon" name="phone" />
        <Field label="Alamat" name="address" className="md:col-span-2" />
      </Section>

      <Section title="Pekerjaan">
        <Field label="Jabatan" name="position" required />
        <Field label="Departemen" name="department" />
        <Field label="Tanggal mulai kerja" name="hireDate" type="date" required />
        <Field label="Akhir probation" name="probationEndDate" type="date" />
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Tipe kontrak</span>
          <select name="contractType" required defaultValue="pkwt" className={INPUT}>
            <option value="pkwt">PKWT</option>
            <option value="pkwtt">PKWTT</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-brand-ink">Jadwal kerja</span>
          <select name="workSchedule" required defaultValue="fulltime" className={INPUT}>
            <option value="fulltime">Full-time</option>
            <option value="parttime">Part-time</option>
            <option value="shift">Shift</option>
          </select>
        </label>
      </Section>

      <Section title="Pajak, BPJS, dan kontak darurat">
        <Field label="NPWP" name="npwp" />
        <Field label="BPJS Kesehatan" name="bpjsKesehatan" />
        <Field label="BPJS Ketenagakerjaan" name="bpjsTenagakerja" />
        <Field label="Nama kontak darurat" name="emergencyContactName" />
        <Field label="Telepon kontak darurat" name="emergencyContactPhone" />
      </Section>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/hr/employees')}
          className="rounded-lg border border-brand-cream-3 bg-card px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-cream-1"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-red px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-red-dark disabled:opacity-50"
        >
          {isPending ? 'Menyimpan...' : 'Simpan karyawan'}
        </button>
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
      <input name={name} type={type} required={required} className={INPUT} />
    </label>
  );
}
