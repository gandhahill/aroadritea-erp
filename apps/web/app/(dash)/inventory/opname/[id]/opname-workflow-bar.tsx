/**
 * OpnameWorkflowBar — progress indicator for opname workflow.
 *
 * Shows 4 steps: Buat → Hitung → Ajukan → Setujui
 * Current step highlighted based on session status.
 */

const STEPS = [
  { key: 'draft',        label: 'Buat Sesi',     sub: 'Draf' },
  { key: 'in_progress',  label: 'Hitung Fisik',  sub: 'Sedang Berlangsung' },
  { key: 'submitted',    label: 'Ajukan',         sub: 'Diajukan' },
  { key: 'approved',     label: 'Setujui',        sub: 'Disetujui' },
];

type Status = 'draft' | 'in_progress' | 'submitted' | 'approved' | 'cancelled';

const STEP_INDEX: Record<Status, number> = {
  draft: 0,
  in_progress: 1,
  submitted: 2,
  approved: 3,
  cancelled: -1,
};

export function OpnameWorkflowBar({ status }: { status: string }) {
  const current = STEP_INDEX[status as Status] ?? 0;
  const isCancelled = status === 'cancelled';

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5">
        <svg className="h-4 w-4 flex-shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span className="text-sm font-medium text-rose-700">Sesi opname ini dibatalkan.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={step.key} className="flex items-center">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? 'bg-brand-jade text-white'
                    : active
                    ? 'bg-brand-ember-5 text-white'
                    : 'bg-brand-cream-2 text-brand-ink-3'
                }`}
              >
                {done ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <div className="hidden sm:block">
                <p className={`text-xs font-semibold ${active ? 'text-brand-ember-5' : done ? 'text-brand-jade' : 'text-brand-ink-3'}`}>
                  {step.label}
                </p>
                {active && <p className="text-xs text-brand-ink-3">{step.sub}</p>}
              </div>
            </div>

            {/* Connector */}
            {idx < STEPS.length - 1 && (
              <div className={`mx-2 h-px w-8 flex-shrink-0 sm:mx-3 sm:w-12 ${done ? 'bg-brand-jade' : 'bg-brand-cream-2'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}