import type { FaqEntry, RequirementField } from '@wavehub/shared-types'

// Editors for a service listing's buyer questions and FAQ (pages/sell/services/*). Bounds mirror
// CreateListingDto: ≤10 questions (key [a-z0-9_]{1,40}, label 1–80, dropdown ≤20 options of 1–60
// chars) and ≤10 FAQ entries (question 3–200, answer 3–1000). Question keys are generated once
// and never change — orders store the buyer's answers under them.

export const MAX_REQUIREMENTS = 10
export const MAX_FAQ = 10

const TYPE_LABELS: Array<[RequirementField['type'], string]> = [
  ['text', 'მოკლე ტექსტი'],
  ['textarea', 'გრძელი ტექსტი'],
  ['number', 'რიცხვი'],
  ['dropdown', 'არჩევანი სიიდან'],
]

export function newRequirementKey(existing: RequirementField[]): string {
  let key = ''
  do key = `q_${Math.random().toString(36).slice(2, 8)}`
  while (existing.some((f) => f.key === key))
  return key
}

// A Georgian error message, or null when the lists are valid.
export function validateServiceExtras(fields: RequirementField[], faq: FaqEntry[]): string | null {
  if (fields.length > MAX_REQUIREMENTS) return `მაქსიმუმ ${MAX_REQUIREMENTS} კითხვა.`
  for (const [i, f] of fields.entries()) {
    if (!f.label.trim() || f.label.trim().length > 80) return `კითხვა #${i + 1}: სათაური 1–80 სიმბოლო.`
    if (f.type === 'dropdown') {
      const options = f.options ?? []
      if (options.length === 0) return `კითხვა #${i + 1}: დაამატეთ მინიმუმ ერთი ვარიანტი.`
      if (options.length > 20 || options.some((o) => o.length < 1 || o.length > 60)) return `კითხვა #${i + 1}: მაქს. 20 ვარიანტი, თითო 1–60 სიმბოლო.`
    }
  }
  if (faq.length > MAX_FAQ) return `მაქსიმუმ ${MAX_FAQ} FAQ.`
  for (const [i, e] of faq.entries()) {
    if (e.q.trim().length < 3 || e.q.trim().length > 200) return `FAQ #${i + 1}: კითხვა 3–200 სიმბოლო.`
    if (e.a.trim().length < 3 || e.a.trim().length > 1000) return `FAQ #${i + 1}: პასუხი 3–1000 სიმბოლო.`
  }
  return null
}

export function cleanRequirements(fields: RequirementField[]): RequirementField[] {
  return fields.map((f) => ({
    key: f.key,
    label: f.label.trim(),
    type: f.type,
    required: f.required,
    ...(f.type === 'dropdown' ? { options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) } : {}),
  }))
}

export function cleanFaq(faq: FaqEntry[]): FaqEntry[] {
  return faq.map((e) => ({ q: e.q.trim(), a: e.a.trim() }))
}

export function RequirementsEditor({ value, onChange }: { value: RequirementField[]; onChange: (next: RequirementField[]) => void }) {
  const patch = (i: number, change: Partial<RequirementField>) => onChange(value.map((f, j) => (j === i ? { ...f, ...change } : f)))
  return (
    <div className="sv-rows">
      {value.length === 0 && <p className="sv-muted">კითხვები არ არის — მყიდველი შეკვეთისას არაფერს შეავსებს.</p>}
      {value.map((field, i) => (
        <div key={field.key} className="sv-row sv-req">
          <label className="sp-field">
            <span>კითხვა მყიდველს</span>
            <input maxLength={80} value={field.label} placeholder="მაგ. მიმდინარე რანგი" onChange={(e) => patch(i, { label: e.target.value })} />
          </label>
          <label className="sp-field">
            <span>პასუხის ტიპი</span>
            <select value={field.type} onChange={(e) => patch(i, { type: e.target.value as RequirementField['type'], options: e.target.value === 'dropdown' ? field.options ?? [] : undefined })}>
              {TYPE_LABELS.map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {field.type === 'dropdown' && (
            <label className="sp-field sv-wide">
              <span>ვარიანტები (მძიმით)</span>
              <input value={(field.options ?? []).join(', ')} placeholder="EU, Asia, NA" onChange={(e) => patch(i, { options: e.target.value.split(',').map((o) => o.trimStart()) })} />
            </label>
          )}
          <label className="sv-check">
            <input type="checkbox" checked={field.required} onChange={(e) => patch(i, { required: e.target.checked })} />
            <span>სავალდებულო</span>
          </label>
          <button type="button" className="sv-remove" aria-label="კითხვის წაშლა" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      {value.length < MAX_REQUIREMENTS && (
        <button type="button" className="sv-add" onClick={() => onChange([...value, { key: newRequirementKey(value), label: '', type: 'text', required: true }])}>
          + კითხვის დამატება
        </button>
      )}
    </div>
  )
}

export function FaqEditor({ value, onChange }: { value: FaqEntry[]; onChange: (next: FaqEntry[]) => void }) {
  const patch = (i: number, change: Partial<FaqEntry>) => onChange(value.map((e, j) => (j === i ? { ...e, ...change } : e)))
  return (
    <div className="sv-rows">
      {value.length === 0 && <p className="sv-muted">FAQ არ არის.</p>}
      {value.map((entry, i) => (
        <div key={i} className="sv-row sv-faq">
          <label className="sp-field">
            <span>კითხვა</span>
            <input maxLength={200} value={entry.q} placeholder="მაგ. რამდენ ხანში სრულდება?" onChange={(e) => patch(i, { q: e.target.value })} />
          </label>
          <label className="sp-field sv-wide">
            <span>პასუხი</span>
            <textarea rows={2} maxLength={1000} value={entry.a} onChange={(e) => patch(i, { a: e.target.value })} />
          </label>
          <button type="button" className="sv-remove" aria-label="FAQ-ის წაშლა" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      {value.length < MAX_FAQ && (
        <button type="button" className="sv-add" onClick={() => onChange([...value, { q: '', a: '' }])}>
          + FAQ-ის დამატება
        </button>
      )}
    </div>
  )
}
