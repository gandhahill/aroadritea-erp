/**
 * Shift definitions seed data — SD §21.8.1
 *
 * Two standard shifts per Aroadri SOP:
 * - Shift Pagi:  09:30–17:30 WIB (Store operational: 09:30)
 * - Shift Siang: 14:30–22:30 WIB (Mall hours end: 22:00)
 *
 * Break windows per SOP:
 * - Pagi break:  13:30–15:30 WIB
 * - Siang break: 16:00–17:00 WIB or after 20:30 WIB (exception)
 */

export const SHIFT_DEFINITIONS_SEED = [
  {
    id: 'shift-pagi',
    code: 'PAGI',
    name: 'Shift Pagi',
    startTime: '09:30',
    endTime: '17:30',
    breakStart: '13:30',
    breakEnd: '15:30',
    isActive: true,
  },
  {
    id: 'shift-siang',
    code: 'SIANG',
    name: 'Shift Siang',
    startTime: '14:30',
    endTime: '22:30',
    breakStart: '16:00',
    breakEnd: '17:00',
    isActive: true,
  },
];
