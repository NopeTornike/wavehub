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

function translateString(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const hit = DICTIONARY[trimmed]
  if (!hit) return null
  const leading = value.match(/^\s*/)?.[0] ?? ''
  const trailing = value.match(/\s*$/)?.[0] ?? ''
  return `${leading}${hit}${trailing}`
}

function applyToTextNode(node: Text, language: Language) {
  if (node.parentElement?.closest(SKIP_SELECTOR)) return
  const current = node.nodeValue ?? ''
  if (language === 'en') {
    const translated = translateString(current)
    if (translated === null) return
    originalText.set(node, current)
    if (current !== translated) node.nodeValue = translated
  } else {
    const original = originalText.get(node)
    if (original !== undefined && current !== original) node.nodeValue = original
    originalText.delete(node)
  }
}

function applyToElementAttributes(element: Element, language: Language) {
  for (const attribute of ATTRIBUTES) {
    const stashKey = `${ORIGINAL_ATTR_PREFIX}${attribute}`
    if (language === 'en') {
      const value = element.getAttribute(attribute)
      if (!value) continue
      const translated = DICTIONARY[value.trim()]
      if (!translated) continue
      element.setAttribute(stashKey, value)
      element.setAttribute(attribute, translated)
    } else if (element.hasAttribute(stashKey)) {
      element.setAttribute(attribute, element.getAttribute(stashKey) ?? '')
      element.removeAttribute(stashKey)
    }
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
    const translated = DICTIONARY[page.trim()]
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
    if (language !== 'en') return
    translateTitle(language)

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') {
          applyToTextNode(record.target as Text, 'en')
        } else if (record.type === 'attributes' && record.target instanceof Element) {
          const name = record.attributeName ?? ''
          if (!name.startsWith(ORIGINAL_ATTR_PREFIX)) applyToElementAttributes(record.target, 'en')
        } else {
          record.addedNodes.forEach((node) => applyToSubtree(node, 'en'))
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
    const titleObserver = new MutationObserver(() => translateTitle('en'))
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
