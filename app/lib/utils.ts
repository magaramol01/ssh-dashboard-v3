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
 * Helper to extract balanced curly-brace content starting at startIndex.
 */
function extractBalancedBraces(str: string, startIndex: number): { content: string; endIndex: number } | null {
  if (str[startIndex] !== '{') return null
  let depth = 0
  const start = startIndex + 1
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') {
      depth--
      if (depth === 0) {
        return { content: str.slice(start, i), endIndex: i }
      }
    }
  }
  return null
}

/**
 * Replaces LaTeX fractions (\frac{A}{B}, \dfrac{A}{B}, \tfrac{A}{B}) with clean (A) / (B) or A / B.
 */
function replaceFractions(str: string): string {
  let res = str
  let iterations = 0
  while (iterations++ < 20) {
    const match = res.match(/\\(?:d|t)?frac\s*\{/)
    if (!match || match.index === undefined) break
    const fracStart = match.index
    const numOpenBrace = fracStart + match[0].length - 1
    const num = extractBalancedBraces(res, numOpenBrace)
    if (!num) break

    let denomOpenBrace = num.endIndex + 1
    while (denomOpenBrace < res.length && /\s/.test(res[denomOpenBrace]!)) {
      denomOpenBrace++
    }
    if (res[denomOpenBrace] !== '{') break
    const denom = extractBalancedBraces(res, denomOpenBrace)
    if (!denom) break

    const numClean = replaceFractions(num.content).trim()
    const denomClean = replaceFractions(denom.content).trim()

    const wrapNum = numClean.includes(' ') || numClean.includes('+') || numClean.includes('-') || numClean.includes('×')
    const wrapDenom = denomClean.includes(' ') || denomClean.includes('+') || denomClean.includes('-') || denomClean.includes('×') || denomClean.includes('*')

    const replacement = (wrapNum ? `(${numClean})` : numClean) + ' / ' + (wrapDenom ? `(${denomClean})` : denomClean)
    res = res.slice(0, fracStart) + replacement + res.slice(denom.endIndex + 1)
  }
  return res
}

/**
 * Strips text wrappers like \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}, etc.
 */
function stripTextMacros(str: string): string {
  let res = str
  let iterations = 0
  while (iterations++ < 50) {
    const match = res.match(/\\(?:text|mathrm|mathbf|mathit|mathsf|mathtt|operatorname)\s*\{/)
    if (!match || match.index === undefined) break
    const start = match.index
    const openBrace = start + match[0].length - 1
    const braced = extractBalancedBraces(res, openBrace)
    if (!braced) break
    res = res.slice(0, start) + braced.content + res.slice(braced.endIndex + 1)
  }
  return res
}

/**
 * Sanitizes LaTeX math syntax emitted by LLMs into clean Unicode and readable text.
 * Converts formulas like `\text{CII} \propto \frac{\text{Total CO}_2 \text{ Emissions}}{\text{DWT} \times \text{Distance Run}}`
 * into `CII ∝ (Total CO₂ Emissions) / (DWT × Distance Run)`,
 * while safely preserving standard currency notations like `$100 to $200`.
 */
export function cleanLatexMath(text: string): string {
  if (!text) return ''
  let s = text

  // 1. Display and inline math blocks
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => inner.trim())
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => inner.trim())
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => inner.trim())

  // 2. Fractions (\frac{num}{den}, \dfrac, \tfrac)
  s = replaceFractions(s)

  // 3. Text and font wrappers (\text{...}, \mathrm{...}, \mathbf{...})
  s = stripTextMacros(s)

  // 4. Square roots
  s = s.replace(/\\sqrt\{([^}]+)\}/g, '√($1)')

  // 5. Chemical formulas with subscripts (e.g. CO_2, CO_{2}, SO_2, NO_x)
  s = s.replace(/\bCO_\{2\}|\bCO_2\b/g, 'CO₂')
  s = s.replace(/\bSO_\{2\}|\bSO_2\b/g, 'SO₂')
  s = s.replace(/\bNO_\{x\}|\bNO_x\b/g, 'NOₓ')

  // 6. Mathematical & relational operators
  s = s.replace(/\\propto\b/g, '∝')
  s = s.replace(/\\(?:ge|geq)\b/g, '≥')
  s = s.replace(/\\(?:le|leq)\b/g, '≤')
  s = s.replace(/\\(?:rightarrow|to)\b/g, '→')
  s = s.replace(/\\leftarrow\b/g, '←')
  s = s.replace(/\\uparrow\b/g, '↑')
  s = s.replace(/\\downarrow\b/g, '↓')
  s = s.replace(/\\Rightarrow\b/g, '⇒')
  s = s.replace(/\\Leftarrow\b/g, '⇐')
  s = s.replace(/\\Leftrightarrow\b/g, '⇔')
  s = s.replace(/\\pm\b/g, '±')
  s = s.replace(/\\mp\b/g, '∓')
  s = s.replace(/\\approx\b/g, '≈')
  s = s.replace(/\\sim\b/g, '~')
  s = s.replace(/\\neq\b/g, '≠')
  s = s.replace(/\\equiv\b/g, '≡')
  s = s.replace(/\\times\b/g, '×')
  s = s.replace(/\\cdot\b/g, '·')
  s = s.replace(/\\div\b/g, '÷')
  s = s.replace(/\\Delta\b/g, 'Δ')
  s = s.replace(/\\nabla\b/g, '∇')
  s = s.replace(/\\partial\b/g, '∂')
  s = s.replace(/\\infty\b/g, '∞')
  s = s.replace(/\\sum\b/g, '∑')
  s = s.replace(/\\prod\b/g, '∏')
  s = s.replace(/\\int\b/g, '∫')
  s = s.replace(/\\degree\b|\\circ\b/g, '°')
  s = s.replace(/\\%/g, '%')

  // Greek letters
  s = s.replace(/\\alpha\b/g, 'α')
  s = s.replace(/\\beta\b/g, 'β')
  s = s.replace(/\\gamma\b/g, 'γ')
  s = s.replace(/\\theta\b/g, 'θ')
  s = s.replace(/\\lambda\b/g, 'λ')
  s = s.replace(/\\mu\b/g, 'μ')
  s = s.replace(/\\pi\b/g, 'π')
  s = s.replace(/\\sigma\b/g, 'σ')
  s = s.replace(/\\omega\b/g, 'ω')
  s = s.replace(/\\Omega\b/g, 'Ω')

  // Delimiters & spacing
  s = s.replace(/\\left\(/g, '(').replace(/\\right\)/g, ')')
  s = s.replace(/\\left\[/g, '[').replace(/\\right\]/g, ']')
  s = s.replace(/\\left\\\{/g, '{').replace(/\\right\\\}/g, '}')
  s = s.replace(/\\\{/g, '{').replace(/\\\}/g, '}')
  s = s.replace(/\\left\./g, '').replace(/\\right\./g, '')
  s = s.replace(/\\(?:quad|qquad)\b/g, ' ')
  s = s.replace(/\\[,;:!]/g, ' ')

  // Common exponents
  s = s.replace(/\^\{?2\}?/g, '²')
  s = s.replace(/\^\{?3\}?/g, '³')

  // 7. Strip remaining math delimiters $...$
  // Only strips if it contains math operators/symbols, Greek letters, or converted tokens,
  // ensuring currency strings like "$100 and $200" are strictly preserved.
  s = s.replace(
    /\$([^\$\n]*?(?:[\\≥≤→←↑↓±∓≈~≠≡×·÷Δ∇∂∞∑∏∫°%_^\/+\-∝αβγθλμπσωΩ]|CO₂|SO₂|NOₓ)[^\$\n]*?)\$/g,
    (_, inner) => inner.trim()
  )

  // 8. Clean up extra consecutive whitespace
  s = s.replace(/[ \t]{2,}/g, ' ')

  return s
}

