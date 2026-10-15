import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import KA_TO_EN from './i18n-ka-en.json'
import KA_TO_EN_APP from './i18n-ka-en.app.json'

// The site's copy is written in Georgian (the default, matching the static prototype's own
// default of `ka`). English mode works the same way the prototype's site-footer.js does: a
// dictionary of exact strings, applied to rendered text nodes and a few attributes, kept in sync
// with a MutationObserver as React re-renders. Georgian is always the source of truth — React
// renders Georgian, and English is a presentation layer over it, so switching back just restores
// the originals. The dictionary is the prototype's own (inverted), so strings ported verbatim from
// the prototype translate exactly as they do there; add app-only strings to i18n-ka-en.app.json.
//
// The chosen language is a per-viewer display preference, so it lives in localStorage (wrapped
// in try/catch — it can be unavailable in private windows).

export type Language = 'ka' | 'en'

const STORAGE_KEY = 'wavehub.language'
// Prototype dictionary first, then strings this app adds (its own copy, or Georgian for text the
// prototype never translated) — the app file wins on a clash.
const DICTIONARY: Record<string, string> = { ...(KA_TO_EN as Record<string, string>), ...(KA_TO_EN_APP as Record<string, string>) }
const ATTRIBUTES = ['aria-label', 'title', 'placeholder'] as const
const SKIP_SELECTOR = 'script, style, textarea, input, [data-i18n-keep], [contenteditable="true"]'

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void }

const LanguageContext = createContext<LanguageContextValue>({ language: 'ka', setLanguage: () => undefined })

// Original Georgian values, so English can be undone exactly (including surrounding whitespace).
const originalText = new WeakMap<Text, string>()
const ORIGINAL_ATTR_PREFIX = 'data-i18n-original-'

// Entries whose key contains {0}, {1}… are patterns for text rendered from a template string
// (e.g. `{0} აქტიური შეკვეთა`): the placeholders match the interpolated values and are carried
// into the English value.
const PATTERNS: Array<{ regex: RegExp; english: string; literal: number }> = Object.entries(DICTIONARY)
  .filter(([key]) => /\{\d\}/.test(key))
  .map(([key, english]) => ({
    regex: new RegExp(`^${key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d)\\?\}/g, '(?<p$1>[\\s\\S]+?)')}$`),
    english,
    literal: key.replace(/\{\d\}/g, '').length,
  }))
  // Most specific first, so a short generic pattern ("{0} დღე") can't shadow a longer one.
  .sort((a, b) => b.literal - a.literal)

// Dates are formatted with the `ka-GE` locale, which renders Georgian month/day names.
const GEORGIAN_DATE_WORDS: Array<[RegExp, string]> = [
  ['იანვარი', 'January'], ['თებერვალი', 'February'], ['მარტი', 'March'], ['აპრილი', 'April'],
  ['მაისი', 'May'], ['ივნისი', 'June'], ['ივლისი', 'July'], ['აგვისტო', 'August'],
  ['სექტემბერი', 'September'], ['ოქტომბერი', 'October'], ['ნოემბერი', 'November'], ['დეკემბერი', 'December'],
  ['იან\\.?', 'Jan'], ['თებ\\.?', 'Feb'], ['მარ\\.?', 'Mar'], ['აპრ\\.?', 'Apr'], ['მაი\\.?', 'May'],
  ['ივნ\\.?', 'Jun'], ['ივლ\\.?', 'Jul'], ['აგვ\\.?', 'Aug'], ['სექ\\.?', 'Sep'], ['ოქტ\\.?', 'Oct'],
  ['ნოე\\.?', 'Nov'], ['დეკ\\.?', 'Dec'],
  ['ორშაბათი', 'Monday'], ['სამშაბათი', 'Tuesday'], ['ოთხშაბათი', 'Wednesday'], ['ხუთშაბათი', 'Thursday'],
  ['პარასკევი', 'Friday'], ['შაბათი', 'Saturday'], ['კვირა', 'Sunday'],
  ['ორშ\\.?', 'Mon'], ['სამ\\.?', 'Tue'], ['ოთხ\\.?', 'Wed'], ['ხუთ\\.?', 'Thu'], ['პარ\\.?', 'Fri'], ['შაბ\\.?', 'Sat'], ['კვი\\.?', 'Sun'],
].map(([ka, en]) => [new RegExp(`(^|[\\s,])${ka}(?=$|[\\s,])`, 'g'), en] as [RegExp, string])
const GEORGIAN = /[\u10A0-\u10FF]/

function translateDate(value: string): string | null {
  if (!/\d/.test(value)) return null
  let out = value.replace(/(\d)\s*წ\.?/g, '$1')
  for (const [regex, english] of GEORGIAN_DATE_WORDS) out = out.replace(regex, (_m, lead: string) => `${lead}${english}`)
  return out !== value && !GEORGIAN.test(out) ? out : null
}

// Labels joined in code ("მყიდველი / დაგეგმილია", "PUBG Mobile · ანგარიში", "ქოუჩი | WaveHub").
const SEPARATORS = /( \/ | · | • | \| | — )/

function translateTrimmed(trimmed: string): string | null {
  const hit = DICTIONARY[trimmed]
  if (hit) return hit
  if (!GEORGIAN.test(trimmed)) return null
  for (const { regex, english } of PATTERNS) {
    const match = regex.exec(trimmed)
    if (!match) continue
    // A placeholder can itself hold a Georgian label (a status, a stage name) — translate it too.
    return english.replace(/\{(\d)\}/g, (_m, i: string) => {
      const value = match.groups?.[`p${i}`] ?? ''
      return (GEORGIAN.test(value) && translateTrimmed(value.trim())) || value
    })
  }
  const date = translateDate(trimmed)
  if (date) return date
  const parts = trimmed.split(SEPARATORS)
  if (parts.length > 1) {
    const translated = parts.map((part) => (GEORGIAN.test(part) ? translateTrimmed(part.trim()) : part))
    if (translated.every((part) => part !== null)) return translated.join('')
  }
  return null
}

function translateString(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const hit = translateTrimmed(trimmed)
  if (!hit) return null
  const leading = value.match(/^\s*/)?.[0] ?? ''
  const trailing = value.match(/\s*$/)?.[0] ?? ''
  return `${leading}${hit}${trailing}`
}

// Owner rule (2026-10-15, the same as Tornike's site-footer.js glossary): these gaming / platform
// terms are written in English in both languages, so the platform reads the same everywhere. In
// Georgian mode a UI string whose English translation uses one of them gets the Georgian word
// swapped for the English term ("საფულე" → "Wallet", "შეფასებები ჯერ არ არის" → "Reviews ჯერ არ
// არის"). Only strings with a dictionary entry are touched, so user-written text (titles,
// descriptions, reviews, names) never is. Each rule: [English term in the translation, the
// Georgian word(s) for it]. More specific rules first.
const KA_WORD = '(?<![\u10D0-\u10FF])'
const GLOSSARY: Array<[RegExp, RegExp]> = (
  [
    [/\bverified coach(?:es)?\b/i, 'ვერიფიცირებულ[ა-ჰ]*\s+(?:ქოუჩ|კოუჩ)[ა-ჰ]*'],
    [/\bverified sellers?\b/i, 'ვერიფიცირებულ[ა-ჰ]*\s+გამყიდველ[ა-ჰ]*'],
    [/\bvod reviews?\b/i, 'VOD\s+(?:ანალიზ|რევიუ|მიმოხილვ)[ა-ჰ]*'],
    [/\brank up\b/i, 'რანკის\s+აწევ[ა-ჰ]*'],
    [/\bteam finder\b/i, 'გუნდის\s+(?:პოვნ|ძებნ)[ა-ჰ]*'],
    [/\bgrand finals?\b/i, 'გრანდ[\s-]*ფინალ[ა-ჰ]*'],
    [/\bsteam keys?\b/i, 'Steam[\s-]+გასაღებ[ა-ჰ]*'],
    [/\bgift cards?\b/i, 'სასაჩუქრე\s+ბარათ[ა-ჰ]*'],
    [/\busernames?\b/i, '(?:მომხმარებლის\s+სახელ|იუზერნეიმ)[ა-ჰ]*'],
    [/\bcoaching\b/i, '(?:ქოუჩინგ|კოუჩინგ)[ა-ჰ]*'],
    [/\bcoach(?:es)?\b/i, '(?:ქოუჩ|კოუჩ)[ა-ჰ]*'],
    [/\bplayoffs?\b/i, 'პლეი-?ოფ[ა-ჰ]*'],
    [/\bmatch(?:es)?\b/i, 'მატჩ[ა-ჰ]*'],
    [/\blobb(?:y|ies)\b/i, 'ლობ[ა-ჰ]*'],
    [/\bbrackets?\b/i, '(?:ბრეკეტ|ბრაკეტ)[ა-ჰ]*'],
    [/\bcheck-?ins?\b/i, 'ჩექ-?ინ[ა-ჰ]*'],
    [/\bleaderboards?\b/i, '(?:ლიდერბორდ|ლიდერების\s+ცხრილ)[ა-ჰ]*'],
    [/\bstat(?:s|istics)\b/i, 'სტატისტიკ[ა-ჰ]*'],
    [/\bseasons?\b/i, 'სეზონ[ა-ჰ]*'],
    [/\bachievements?\b/i, 'მიღწევ[ა-ჰ]*'],
    [/\bbadges?\b/i, 'ბეიჯ[ა-ჰ]*'],
    [/\blevels?\b/i, 'დონ[ა-ჰ]*'],
    [/\branks?\b/i, '(?:რანკ|რანგ)[ა-ჰ]*'],
    [/\bskins?\b/i, 'სკინ[ა-ჰ]*'],
    [/\bmarketplace\b/i, '(?:მარკეტფლეის|მარკეტპლეის|მარკეტ)[ა-ჰ]*'],
    [/\bsellers?\b/i, 'გამყიდველ[ა-ჰ]*'],
    [/\blistings?\b/i, 'განცხადებ[ა-ჰ]*'],
    [/\bbundles?\b/i, 'ბანდლ[ა-ჰ]*'],
    [/\bescrow\b/i, 'ესქრო[ა-ჰ]*'],
    [/\bfeatured\b/i, 'რჩეულ[ა-ჰ]*'],
    [/\bpremium\b/i, 'პრემიუმ[ა-ჰ]*'],
    [/\bsubscriptions?\b/i, 'გამოწერ[ა-ჰ]*'],
    [/\bfollowers?\b/i, 'გამომწერ[ა-ჰ]*'],
    [/\bfollow(?:ing)?\b/i, 'გამოწერ[ა-ჰ]*'],
    [/\bdashboard\b/i, '(?:დაფ|დეშბორდ|დაშბორდ)[ა-ჰ]*'],
    [/\bprofiles?\b/i, 'პროფილ[ა-ჰ]*'],
    [/\bavatars?\b/i, 'ავატარ[ა-ჰ]*'],
    [/\bonline\b/i, 'ონლაინ[ა-ჰ]*'],
    [/\boffline\b/i, 'ოფლაინ[ა-ჰ]*'],
    [/\bverified\b/i, '(?:ვერიფიცირებულ|გადამოწმებულ)[ა-ჰ]*'],
    [/\bratings?\b/i, '(?:რეიტინგ|შეფასებ)[ა-ჰ]*'],
    [/\breviews?\b/i, '(?:შეფასებ|მიმოხილვ)[ა-ჰ]*'],
    [/\bsupport\b/i, '(?:მხარდაჭერ|საფორთ)[ა-ჰ]*'],
    [/\bwallet\b/i, 'საფულ[ა-ჰ]*'],
  ] as Array<[RegExp, string]>
).map(([english, georgian]) => [english, new RegExp(`${KA_WORD}${georgian}`, 'g')])

const TERM_CASE: Record<string, string> = { xp: 'XP', mvp: 'MVP', vod: 'VOD', 'check-in': 'Check-in', checkin: 'Check-in' }
// The English term as written in the translation, in title case ("reviews" → "Reviews").
function termCase(match: string): string {
  return match
    .split(/\s+/)
    .map((word) => TERM_CASE[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// The Georgian string with the glossary terms in English, or null when nothing changes.
function glossaryTrimmed(trimmed: string): string | null {
  if (!GEORGIAN.test(trimmed)) return null
  const english = translateTrimmed(trimmed)
  if (!english) return null
  let out = trimmed
  for (const [englishTerm, georgian] of GLOSSARY) {
    const found = englishTerm.exec(english)
    if (!found) continue
    out = out.replace(georgian, termCase(found[0]))
  }
  return out === trimmed ? null : out
}

function glossaryString(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const hit = glossaryTrimmed(trimmed)
  if (!hit) return null
  const leading = value.match(/^\s*/)?.[0] ?? ''
  const trailing = value.match(/\s*$/)?.[0] ?? ''
  return `${leading}${hit}${trailing}`
}

// The Georgian source of a text node, and the value this layer last wrote into it. React may
// replace the text at any time (a new count, a status change): then the node's value no longer
// equals what was written, and the new value is the source.
const writtenText = new WeakMap<Text, string>()

function applyToTextNode(node: Text, language: Language) {
  if (node.parentElement?.closest(SKIP_SELECTOR)) return
  const current = node.nodeValue ?? ''
  const written = writtenText.get(node)
  const source = written !== undefined && current === written ? (originalText.get(node) ?? current) : current
  const next = language === 'en' ? translateString(source) : glossaryString(source)
  if (next === null || next === source) {
    if (current !== source) node.nodeValue = source
    originalText.delete(node)
    writtenText.delete(node)
    return
  }
  originalText.set(node, source)
  writtenText.set(node, next)
  if (current !== next) node.nodeValue = next
}

function applyToElementAttributes(element: Element, language: Language) {
  if (element.closest('[data-i18n-keep]')) return
  for (const attribute of ATTRIBUTES) {
    const stashKey = `${ORIGINAL_ATTR_PREFIX}${attribute}`
    const value = element.getAttribute(attribute)
    // A stashed original is still the source unless the attribute was changed since.
    const stashed = element.getAttribute(stashKey)
    const source = stashed !== null && element.getAttribute(`${stashKey}-written`) === value ? stashed : value
    if (source === null) continue
    const next = source.trim() ? (language === 'en' ? translateTrimmed(source.trim()) : glossaryTrimmed(source.trim())) : null
    if (!next || next === source) {
      if (stashed !== null) {
        element.removeAttribute(stashKey)
        element.removeAttribute(`${stashKey}-written`)
        if (value !== source) element.setAttribute(attribute, source)
      }
      continue
    }
    element.setAttribute(stashKey, source)
    element.setAttribute(`${stashKey}-written`, next)
    if (value !== next) element.setAttribute(attribute, next)
  }
}

function applyToSubtree(root: Node, language: Language) {
  if (root.nodeType === Node.TEXT_NODE) {
    applyToTextNode(root as Text, language)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const element = root as Element
  applyToElementAttributes(element, language)
  element.querySelectorAll('*').forEach((child) => applyToElementAttributes(child, language))
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  nodes.forEach((node) => applyToTextNode(node, language))
}

function translateTitle(language: Language) {
  const [page, ...rest] = document.title.split(' | ')
  if (language === 'en') {
    const translated = translateTrimmed(page.trim())
    if (translated) document.title = [translated, ...rest].join(' | ')
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ka')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      // Reading a stored per-viewer preference once on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === 'en' || stored === 'ka') setLanguageState(stored)
    } catch {
      // storage unavailable — stay on the Georgian default
    }
  }, [])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable — the choice just won't persist
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    applyToSubtree(document.body, language)
    if (language === 'en') translateTitle(language)

    // Georgian mode keeps watching too: the glossary terms (see GLOSSARY) are swapped in as React
    // renders new text.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') {
          applyToTextNode(record.target as Text, language)
        } else if (record.type === 'attributes' && record.target instanceof Element) {
          const name = record.attributeName ?? ''
          if (!name.startsWith(ORIGINAL_ATTR_PREFIX)) applyToElementAttributes(record.target, language)
        } else {
          record.addedNodes.forEach((node) => applyToSubtree(node, language))
        }
      }
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    })
    const titleObserver = new MutationObserver(() => {
      if (language === 'en') translateTitle('en')
    })
    const titleElement = document.querySelector('title')
    if (titleElement) titleObserver.observe(titleElement, { childList: true, characterData: true, subtree: true })
    return () => {
      observer.disconnect()
      titleObserver.disconnect()
    }
  }, [language])

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
