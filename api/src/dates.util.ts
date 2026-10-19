export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function asDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}
