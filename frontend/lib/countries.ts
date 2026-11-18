// Countries for the Tournament Ranking (owner 2026-11-19): ISO 3166-1 alpha-2 code + English name.
// The flag is the Unicode regional-indicator pair, drawn by the device's emoji font; the code is
// always printed beside it, so a system without flag emoji (Windows) still reads "GEO".
export const COUNTRIES: ReadonlyArray<readonly [code: string, name: string, iso3: string]> = [
  ['GE', 'Georgia', 'GEO'],
  ['AM', 'Armenia', 'ARM'],
  ['AZ', 'Azerbaijan', 'AZE'],
  ['TR', 'Türkiye', 'TUR'],
  ['UA', 'Ukraine', 'UKR'],
  ['RU', 'Russia', 'RUS'],
  ['BY', 'Belarus', 'BLR'],
  ['KZ', 'Kazakhstan', 'KAZ'],
  ['UZ', 'Uzbekistan', 'UZB'],
  ['KG', 'Kyrgyzstan', 'KGZ'],
  ['TJ', 'Tajikistan', 'TJK'],
  ['MD', 'Moldova', 'MDA'],
  ['IR', 'Iran', 'IRN'],
  ['IQ', 'Iraq', 'IRQ'],
  ['IL', 'Israel', 'ISR'],
  ['SA', 'Saudi Arabia', 'KSA'],
  ['AE', 'United Arab Emirates', 'UAE'],
  ['EG', 'Egypt', 'EGY'],
  ['PL', 'Poland', 'POL'],
  ['DE', 'Germany', 'GER'],
  ['FR', 'France', 'FRA'],
  ['GB', 'United Kingdom', 'GBR'],
  ['IE', 'Ireland', 'IRL'],
  ['ES', 'Spain', 'ESP'],
  ['PT', 'Portugal', 'POR'],
  ['IT', 'Italy', 'ITA'],
  ['NL', 'Netherlands', 'NED'],
  ['BE', 'Belgium', 'BEL'],
  ['CH', 'Switzerland', 'SUI'],
  ['AT', 'Austria', 'AUT'],
  ['CZ', 'Czechia', 'CZE'],
  ['SK', 'Slovakia', 'SVK'],
  ['HU', 'Hungary', 'HUN'],
  ['RO', 'Romania', 'ROU'],
  ['BG', 'Bulgaria', 'BUL'],
  ['GR', 'Greece', 'GRE'],
  ['RS', 'Serbia', 'SRB'],
  ['HR', 'Croatia', 'CRO'],
  ['LT', 'Lithuania', 'LTU'],
  ['LV', 'Latvia', 'LAT'],
  ['EE', 'Estonia', 'EST'],
  ['FI', 'Finland', 'FIN'],
  ['SE', 'Sweden', 'SWE'],
  ['NO', 'Norway', 'NOR'],
  ['DK', 'Denmark', 'DEN'],
  ['US', 'United States', 'USA'],
  ['CA', 'Canada', 'CAN'],
  ['MX', 'Mexico', 'MEX'],
  ['BR', 'Brazil', 'BRA'],
  ['AR', 'Argentina', 'ARG'],
  ['CL', 'Chile', 'CHI'],
  ['PE', 'Peru', 'PER'],
  ['CO', 'Colombia', 'COL'],
  ['IN', 'India', 'IND'],
  ['PK', 'Pakistan', 'PAK'],
  ['CN', 'China', 'CHN'],
  ['JP', 'Japan', 'JPN'],
  ['KR', 'South Korea', 'KOR'],
  ['VN', 'Vietnam', 'VIE'],
  ['TH', 'Thailand', 'THA'],
  ['PH', 'Philippines', 'PHI'],
  ['ID', 'Indonesia', 'INA'],
  ['MY', 'Malaysia', 'MAS'],
  ['AU', 'Australia', 'AUS'],
  ['NZ', 'New Zealand', 'NZL'],
  ['ZA', 'South Africa', 'RSA'],
  ['MA', 'Morocco', 'MAR'],
  ['NG', 'Nigeria', 'NGA'],
]

const BY_CODE = new Map(COUNTRIES.map(([code, name, iso3]) => [code, { name, iso3 }]))

export function flagEmoji(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 0x1f1a5 + c.charCodeAt(0)))
}

// "GEO" for GE; an unknown code prints itself.
export function countryLabel(code: string | null | undefined): string {
  if (!code) return ''
  return BY_CODE.get(code.toUpperCase())?.iso3 ?? code.toUpperCase()
}

export function countryName(code: string | null | undefined): string {
  if (!code) return ''
  return BY_CODE.get(code.toUpperCase())?.name ?? code.toUpperCase()
}
