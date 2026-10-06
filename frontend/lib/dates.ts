// Compact Georgian date/time ("3 ოქტ. 2026 14:32") formatted by hand — `ka-GE` locale data is
// missing in some browsers/runtimes (they fall back to English), and the designs use this form.
const MONTHS = ['იან.', 'თებ.', 'მარ.', 'აპრ.', 'მაი.', 'ივნ.', 'ივლ.', 'აგვ.', 'სექ.', 'ოქტ.', 'ნოე.', 'დეკ.']

export function kaDate(value: string | Date): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function kaDateTime(value: string | Date): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${kaDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function kaTime(value: string | Date): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
