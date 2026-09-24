<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import type { SentinelBlock } from '#shared/types/sentinel'
import { cleanLatexMath } from '~/lib/utils'
import InteractiveTableChart from './InteractiveTableChart.vue'

type MarkdownBlockType = Extract<SentinelBlock, { type: 'markdown' }>

const props = defineProps<{
  block?: MarkdownBlockType
  text?: string
}>()

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
})

function applyMaritimeEnhancements(html: string): string {
  let enriched = html

  // IMO Grade Badges
  enriched = enriched.replace(/\b(Grade\s+A)\b/gi, '<span class="inline-flex items-center px-1.5 py-0.2 rounded font-bold text-[10px] bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">$1</span>')
  enriched = enriched.replace(/\b(Grade\s+B)\b/gi, '<span class="inline-flex items-center px-1.5 py-0.2 rounded font-bold text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">$1</span>')
  enriched = enriched.replace(/\b(Grade\s+C)\b/gi, '<span class="inline-flex items-center px-1.5 py-0.2 rounded font-bold text-[10px] bg-lime-500/15 text-lime-700 dark:text-lime-400 border border-lime-500/30">$1</span>')
  enriched = enriched.replace(/\b(Grade\s+D)\b/gi, '<span class="inline-flex items-center px-1.5 py-0.2 rounded font-bold text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">$1</span>')
  enriched = enriched.replace(/\b(Grade\s+E)\b/gi, '<span class="inline-flex items-center px-1.5 py-0.2 rounded font-bold text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">$1</span>')

  // Validation Severities in tables / lists
  enriched = enriched.replace(/\b(CRITICAL)\b/g, '<span class="inline-flex items-center px-1.5 py-0.2 rounded font-bold text-[9px] bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 uppercase tracking-wide">CRITICAL</span>')
  enriched = enriched.replace(/\b(WARNING)\b/g, '<span class="inline-flex items-center px-1.5 py-0.2 rounded font-bold text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wide">WARNING</span>')
  enriched = enriched.replace(/\b(PASSED|PASS|APPROVE\b)/g, '<span class="inline-flex items-center px-1.5 py-0.2 rounded font-bold text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">$1</span>')

  // Marine units and telemetry chips
  enriched = enriched.replace(/\b(\d[\d,]*(?:\.\d+)?\s*(?:rpm|RPM|knots|kts|kt|nm|NM|bar|°C|kW|hours|hrs|UTC|DWT|DWT-nm|dwt-nm|gCO[2₂]\/(?:dwt-nm|tnm|MT·NM)|MT\s*CO[2₂]?|MT))\b/g, '<span class="tabular-nums text-[10.5px] font-semibold text-foreground bg-muted/60 px-1 py-0.5 rounded border border-border/40 font-mono">$1</span>')

  // Currency formats
  enriched = enriched.replace(/([€$]\s*[\d,]+(?:\.\d+)?)/g, '<span class="font-semibold tabular-nums text-foreground font-mono">$1</span>')

  // Mathematical formula callouts (e.g. CII ∝ (Total CO₂ Emissions) / (DWT × Distance Run))
  enriched = enriched.replace(
    /\b(CII\s*[∝=]\s*(?:\([^)]+\)|[A-Za-z0-9_₂\s]+)\s*\/\s*(?:\([^)]+\)|[A-Za-z0-9_₂\s×*]+))/g,
    '<code class="inline-block px-2 py-0.5 my-1 text-[11px] font-mono font-medium rounded bg-muted/80 text-foreground border border-border/60">$1</code>'
  )

  return enriched
}

interface HtmlChunk {
  type: 'html'
  html: string
}

interface TableChunk {
  type: 'table'
  columns: Array<{ key: string; label: string }>
  rows: Array<Record<string, any>>
}

type ContentChunk = HtmlChunk | TableChunk

const contentChunks = computed<ContentChunk[]>(() => {
  const content = props.text ?? props.block?.text ?? ''
  if (!content.trim()) return []

  try {
    const sanitized = cleanLatexMath(content)
    const tokens = marked.lexer(sanitized)
    const chunks: ContentChunk[] = []
    let currentTokens: any[] = []

    const flushHtml = () => {
      if (currentTokens.length > 0) {
        const rawHtml = marked.parser(currentTokens as any)
        chunks.push({
          type: 'html',
          html: applyMaritimeEnhancements(rawHtml),
        })
        currentTokens = []
      }
    }

    for (const token of tokens) {
      if (token.type === 'table') {
        flushHtml()

        const header = (token as any).header || []
        const columns = header.map((h: any, colIdx: number) => ({
          key: `col_${colIdx}`,
          label: (h.text || `Col ${colIdx + 1}`).replace(/^\*{1,2}(.*?)\*{1,2}$/, '$1').trim(),
        }))

        const rawRows = (token as any).rows || []
        const rows = rawRows.map((row: any[]) => {
          const rowObj: Record<string, any> = {}
          row.forEach((cell: any, colIdx: number) => {
            rowObj[`col_${colIdx}`] = (cell.text ?? '').replace(/^\*{1,2}(.*?)\*{1,2}$/, '$1').trim()
          })
          return rowObj
        })

        chunks.push({
          type: 'table',
          columns,
          rows,
        })
      } else {
        currentTokens.push(token)
      }
    }

    flushHtml()
    return chunks
  } catch {
    return [{ type: 'html', html: props.text ?? props.block?.text ?? '' }]
  }
})
</script>

<template>
  <div class="sentinel-markdown-content text-xs text-foreground leading-relaxed space-y-2 select-text">
    <template v-for="(chunk, idx) in contentChunks" :key="idx">
      <div v-if="chunk.type === 'html'" v-html="chunk.html" />
      <InteractiveTableChart
        v-else-if="chunk.type === 'table'"
        :columns="chunk.columns"
        :rows="chunk.rows"
        initial-mode="auto"
      />
    </template>
  </div>
</template>

<style scoped>
.sentinel-markdown-content :deep(h1),
.sentinel-markdown-content :deep(h2) {
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-foreground, #09090b);
  border-bottom: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
  padding-bottom: 0.35rem;
  margin-top: 0.85rem;
  margin-bottom: 0.5rem;
}

.sentinel-markdown-content :deep(h1:first-child),
.sentinel-markdown-content :deep(h2:first-child) {
  margin-top: 0;
}

.sentinel-markdown-content :deep(h3) {
  font-size: 0.775rem;
  font-weight: 600;
  color: var(--color-foreground, #09090b);
  margin-top: 0.65rem;
  margin-bottom: 0.35rem;
}

.sentinel-markdown-content :deep(p) {
  margin-bottom: 0.5rem;
  line-height: 1.55;
}

.sentinel-markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}

.sentinel-markdown-content :deep(ul) {
  list-style-type: disc;
  padding-left: 1.15rem;
  margin-top: 0.35rem;
  margin-bottom: 0.5rem;
  space-y: 0.25rem;
}

.sentinel-markdown-content :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.15rem;
  margin-top: 0.35rem;
  margin-bottom: 0.5rem;
  space-y: 0.25rem;
}

.sentinel-markdown-content :deep(li) {
  margin-bottom: 0.2rem;
  line-height: 1.45;
}

.sentinel-markdown-content :deep(table) {
  width: 100%;
  font-size: 0.6875rem;
  border-collapse: separate;
  border-spacing: 0;
  margin-top: 0.5rem;
  margin-bottom: 0.65rem;
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.12));
  border-radius: 0.375rem;
  overflow: hidden;
}

.sentinel-markdown-content :deep(th) {
  background-color: var(--color-muted, rgba(0, 0, 0, 0.04));
  padding: 0.35rem 0.6rem;
  text-align: left;
  font-weight: 600;
  color: var(--color-foreground, #09090b);
  border-bottom: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
}

.sentinel-markdown-content :deep(td) {
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid var(--color-border, rgba(0, 0, 0, 0.06));
  color: var(--color-muted-foreground, #71717a);
  vertical-align: top;
}

.sentinel-markdown-content :deep(tr:last-child td) {
  border-bottom: none;
}

.sentinel-markdown-content :deep(blockquote) {
  border-left: 3px solid var(--color-primary, #3b82f6);
  background-color: var(--color-muted, rgba(0, 0, 0, 0.03));
  padding: 0.35rem 0.65rem;
  margin: 0.5rem 0;
  border-radius: 0 0.25rem 0.25rem 0;
  color: var(--color-muted-foreground, #71717a);
  font-style: italic;
}

.sentinel-markdown-content :deep(code:not(pre code)) {
  font-family: var(--font-mono, monospace);
  font-size: 0.65rem;
  background-color: var(--color-muted, rgba(0, 0, 0, 0.06));
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.08));
  color: var(--color-primary, #2563eb);
}

.sentinel-markdown-content :deep(pre) {
  background-color: var(--color-muted, rgba(0, 0, 0, 0.05));
  padding: 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
  font-family: var(--font-mono, monospace);
  font-size: 0.6875rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}
</style>
