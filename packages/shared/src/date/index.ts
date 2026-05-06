export const WIB_OFFSET = 7;

export function nowWIB(): Date {
  return new Date();
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]!;
}
