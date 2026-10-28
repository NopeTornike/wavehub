# translations

## Purpose
Staff edits of UI text in both languages (owner 2026-10-28: "a translation system I can edit from
the admin CMS"). The site's copy is Georgian in the code with English from
`frontend/lib/i18n-ka-en*.json`. This module stores **overrides** on top of that.

## Key files
- `ui-translation.entity.ts`: `ui_translations` (migration `1784391000000-UiTranslations`).
  - `key` (unique) is the Georgian source text exactly as rendered. Template strings keep their
    `{0}`, `{1}` placeholders, as in the JSON dictionary.
  - `en` is the English replacement and `ka` the Georgian replacement; at least one is set (CHECK).
  - `updatedById` records who edited it.
- `translations.service.ts`:
  - `publicMap()`: `{ [key]: { en?, ka? } }`, cached in memory and dropped on every edit.
  - `adminList()`.
  - `upsert()`: both empty removes the row, so the built-in text returns.
  - `remove()`.
- `translations.controller.ts`:
  - `GET translations` is public.
  - `GET|POST admin/translations` and `DELETE admin/translations/:id` are for Super Admin and Main
    Administrator, the content roles.
  - Edits are audited as `translation.upsert` / `translation.delete`.

## Conventions & gotchas
- **Values are plain text.** The frontend writes them with `nodeValue` / `setAttribute`, never as
  HTML, so a stored `<img onerror>` stays harmless text (e2e-checked).
- Frontend (`lib/i18n.tsx`): `loadTranslationOverrides()` runs once per page load (and again on the
  `wavehub:translations` window event after an admin save).
  - `en` is merged into the dictionary. Patterns are rebuilt, so `{0}` keys work too.
  - `ka` is used in Georgian mode before the glossary, and shown exactly as typed.
  - The built-in dictionary (`BUILT_IN`) stays the fallback.
- Admin UI: `frontend/pages/admin/translations.tsx` (nav "თარგმანები" under Content).
  - It lists every built-in string plus every edit, with search, "edited only", and a free-text
    row for a string not in the list.
  - It checks that `{0}` placeholders are kept.
- e2e: `test/client-round-5.e2e-spec.ts`.
