/**
 * Leave types seed data — SD §21.8 §Cuti & Surat Peringatan, §9.6
 *
 * Indonesian labour law (UU Ketenagakerjaan):
 * - Annual leave (cuti tahunan): minimum 12 days per year after 12 months service
 *
 * Additional types based on SOP + common practice:
 * - Sick leave (surat dokter)
 * - Unpaid leave
 * - Marriage leave
 * - Maternity leave (3 months)
 * - Bereavement leave
 */

export const LEAVE_TYPES_SEED = [
  {
    id: 'leave-annual',
    code: 'annual',
    name: { id: 'Cuti Tahunan', en: 'Annual Leave', zh: '年假' },
    annualQuotaDays: 12,
    isPaid: true,
    requiresApproval: true,
    isActive: true,
  },
  {
    id: 'leave-sick',
    code: 'sick',
    name: { id: 'Cuti Sakit', en: 'Sick Leave', zh: '病假' },
    annualQuotaDays: 14,
    isPaid: true,
    requiresApproval: true,
    isActive: true,
  },
  {
    id: 'leave-unpaid',
    code: 'unpaid',
    name: { id: 'Cuti Tidak Dibayar', en: 'Unpaid Leave', zh: '无薪假' },
    annualQuotaDays: 0, // no preset quota
    isPaid: false,
    requiresApproval: true,
    isActive: true,
  },
  {
    id: 'leave-marriage',
    code: 'marriage',
    name: { id: 'Cuti Menikah', en: 'Marriage Leave', zh: '婚假' },
    annualQuotaDays: 3,
    isPaid: true,
    requiresApproval: true,
    isActive: true,
  },
  {
    id: 'leave-maternity',
    code: 'maternity',
    name: { id: 'Cuti Melahirkan', en: 'Maternity Leave', zh: '产假' },
    annualQuotaDays: 90, // 3 months per UU Kesehatan
    isPaid: true,
    requiresApproval: true,
    isActive: true,
  },
  {
    id: 'leave-bereavement',
    code: 'bereavement',
    name: { id: 'Cuti Duka Cita', en: 'Bereavement Leave', zh: '丧假' },
    annualQuotaDays: 2,
    isPaid: true,
    requiresApproval: false, // can be notified after
    isActive: true,
  },
];
