import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'muted'

/** Map a semantic tone to a `<Badge variant>` (no native "muted" variant). */
export function toneBadge(tone: Tone): 'success' | 'warning' | 'destructive' | 'info' | 'secondary' {
  return tone === 'muted' ? 'secondary' : tone
}

/** Map a semantic tone to a foreground text colour class. */
export function toneText(tone: Tone): string {
  const map: Record<Tone, string> = {
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    info: 'text-info',
    muted: 'text-muted-foreground',
  }
  return map[tone]
}

/** Map a semantic tone to a solid background dot colour class. */
export function toneDot(tone: Tone): string {
  const map: Record<Tone, string> = {
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
    info: 'bg-info',
    muted: 'bg-muted-foreground/50',
  }
  return map[tone]
}

/** "May 28, 2026" from an ISO yyyy-mm-dd slice. Locale-fixed for SSR. */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function shortDate(iso?: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`
}

/** "Avery Quinn" → "AQ". */
export function initials(name?: string): string {
  if (!name) return '—'
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

/**
 * Sanitizes LaTeX math syntax emitted by LLMs into clean Unicode and readable text.
 * Converts formulas like `$\text{CO}_2$` → `CO₂`, `$\ge$` → `≥`, `$\rightarrow$` → `→`,
 * while safely preserving standard currency notations like `$100 to $200`.
 */
export function cleanLatexMath(text: string): string {
  if (!text) return ''
  let s = text

  // 1. Display math blocks $$ ... $$
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => inner.trim())

  // 2. Chemical formulas with \text or \mathrm: $\text{CO}_2$, \text{CO}_2, \text{CO}_{2}, etc.
  s = s.replace(/\$?\\(?:text|mathrm|mathbf)\{CO\}_\{?2\}?\$?/g, 'CO₂')
  s = s.replace(/\$CO_\{?2\}?\$?/g, 'CO₂')
  s = s.replace(/\\(?:text|mathrm|mathbf)\{CO\}/g, 'CO')
  s = s.replace(/\$?\\(?:text|mathrm|mathbf)\{SO\}_\{?2\}?\$?/g, 'SO₂')
  s = s.replace(/\$?\\(?:text|mathrm|mathbf)\{NO\}_\{?x\}?\$?/g, 'NOₓ')

  // 3. Mathematical & relational operators
  s = s.replace(/\\(?:ge|geq)\b/g, '≥')
  s = s.replace(/\\(?:le|leq)\b/g, '≤')
  s = s.replace(/\\(?:rightarrow|to)\b/g, '→')
  s = s.replace(/\\leftarrow\b/g, '←')
  s = s.replace(/\\uparrow\b/g, '↑')
  s = s.replace(/\\downarrow\b/g, '↓')
  s = s.replace(/\\pm\b/g, '±')
  s = s.replace(/\\approx\b/g, '≈')
  s = s.replace(/\\sim\b/g, '~')
  s = s.replace(/\\neq\b/g, '≠')
  s = s.replace(/\\times\b/g, '×')
  s = s.replace(/\\cdot\b/g, '·')
  s = s.replace(/\\Delta\b/g, 'Δ')
  s = s.replace(/\\degree\b|\\circ\b/g, '°')
  s = s.replace(/\\%/g, '%')

  // 4. Strip remaining math delimiters $...$
  // Only strips if it contains math operators/symbols, Greek letters, or converted tokens,
  // ensuring currency strings like "$100 and $200" are strictly preserved.
  s = s.replace(/\$([^\$\n]*?(?:[\\≥≤→←↑↓±≈~≠×·Δ°%_^\/+\-=]|CO₂|SO₂|NOₓ)[^\$\n]*?)\$/g, (_, inner) => inner.trim())

  // 5. Bare subscript/superscript patterns in maritime terms
  s = s.replace(/\bCO_2\b/g, 'CO₂')
  s = s.replace(/\bSO_2\b/g, 'SO₂')
  s = s.replace(/\bNO_x\b/g, 'NOₓ')

  return s
}

