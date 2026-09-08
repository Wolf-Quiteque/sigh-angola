export function localDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function dayOffset(offset: number, base = today()) {
  const d = new Date(`${base}T12:00:00+01:00`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function formatDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat('pt-AO', {
    timeZone: 'Africa/Luanda',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
  }).format(new Date(value.length === 10 ? `${value}T12:00:00+01:00` : value));
}
export function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-AO', {
    timeZone: 'Africa/Luanda',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
export function age(birth: string) {
  const now = today();
  return (
    Number(now.slice(0, 4)) - Number(birth.slice(0, 4)) - (now.slice(5) < birth.slice(5) ? 1 : 0)
  );
}
export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
export function initials(name: string) {
  const parts = name.split(' ');
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`;
}
