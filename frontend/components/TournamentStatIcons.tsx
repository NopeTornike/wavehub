// Small inline SVG icons for the tournament stat row (start date / player count), replacing the
// previous Unicode-glyph placeholders (▣, ♙) — those didn't semantically read as "calendar" or
// "players" and rendered inconsistently across platforms/fonts. Shapes are adapted from the real
// design-system assets (assets/calendar-icon.svg, assets/active-players-icon.svg) but with
// `currentColor` instead of a baked-in fill/stroke, since these sit inside a `<b>` that's colored
// via CSS (`.tournament-card-facts b { color: var(--pink); }`) — an <img src="..."> can't pick up
// that color, only an inlined SVG can. Sized to fill the row's existing 18px icon column
// (`width`/`height: 1em` tracks the `<b>`'s own font-size, matching the desktop/compact breakpoints
// already defined for that column in global.css without needing separate icon-specific rules).
export function CalendarGlyph() {
  return (
    <svg viewBox="0 0 128 128" width="1em" height="1em" fill="none" aria-hidden="true">
      <defs>
        <mask id="calendar-cutouts">
          <rect width="128" height="128" fill="white" />
          <rect x="12" y="48" width="104" height="8" fill="black" fillOpacity=".32" />
          <rect x="32" y="69" width="13" height="12" rx="3" fill="black" />
          <rect x="57.5" y="69" width="13" height="12" rx="3" fill="black" />
          <rect x="83" y="69" width="13" height="12" rx="3" fill="black" />
          <rect x="32" y="91" width="13" height="12" rx="3" fill="black" />
          <rect x="57.5" y="91" width="13" height="12" rx="3" fill="black" />
          <rect x="83" y="91" width="13" height="12" rx="3" fill="black" />
        </mask>
      </defs>
      <g fill="currentColor" mask="url(#calendar-cutouts)">
        <path d="M27 22h74c8.3 0 15 6.7 15 15v69c0 8.3-6.7 15-15 15H27c-8.3 0-15-6.7-15-15V37c0-8.3 6.7-15 15-15Z" />
        <rect x="31" y="9" width="10" height="30" rx="5" />
        <rect x="87" y="9" width="10" height="30" rx="5" />
      </g>
    </svg>
  )
}

export function PlayersGlyph() {
  return (
    <svg viewBox="0 0 64 64" width="1em" height="1em" fill="none" aria-hidden="true">
      <circle cx="27" cy="20" r="11" stroke="currentColor" strokeWidth="5" />
      <path d="M8 54v-7c0-10 8-18 18-18h2c10 0 18 8 18 18v7" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M47 17a7 7 0 0 1 0 13M49 34c5 2 8 7 8 13v4" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
