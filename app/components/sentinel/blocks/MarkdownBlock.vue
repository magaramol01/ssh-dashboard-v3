<script setup lang="ts">
import { computed } from 'vue'
import {
  Ship,
  Activity,
  AlertTriangle,
  FileText,
  CheckCircle2,
  HelpCircle,
  ListChecks,
  Table2,
  Sparkles,
} from 'lucide-vue-next'
import type { SentinelBlock } from '#shared/types/sentinel'

type MarkdownBlock = Extract<SentinelBlock, { type: 'markdown' }>
const props = defineProps<{ block: MarkdownBlock }>()

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatInline(str: string): string {
  let text = escapeHtml(str)
  // Bold text
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
  // Inline code / tags
  text = text.replace(/`([^`]+)`/g, '<code class="font-mono text-[10px] bg-muted/80 text-primary px-1 py-0.5 rounded border border-border/50 font-medium">$1</code>')
  // IMO Grade Badges
  text = text.replace(/\b(Grade\s+A)\b/gi, '<span class="inline-flex items-center px-1.5 py-0.5 rounded font-bold text-[10px] bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">$1</span>')
  text = text.replace(/\b(Grade\s+B)\b/gi, '<span class="inline-flex items-center px-1.5 py-0.5 rounded font-bold text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">$1</span>')
  text = text.replace(/\b(Grade\s+C)\b/gi, '<span class="inline-flex items-center px-1.5 py-0.5 rounded font-bold text-[10px] bg-lime-500/15 text-lime-700 dark:text-lime-400 border border-lime-500/30">$1</span>')
  text = text.replace(/\b(Grade\s+D)\b/gi, '<span class="inline-flex items-center px-1.5 py-0.5 rounded font-bold text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">$1</span>')
  text = text.replace(/\b(Grade\s+E)\b/gi, '<span class="inline-flex items-center px-1.5 py-0.5 rounded font-bold text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">$1</span>')
  // Financial currencies (€, $)
  text = text.replace(/([€$]\s*[\d,]+(?:\.\d+)?)/g, '<span class="font-semibold tabular-nums text-foreground">$1</span>')
  // Marine units and telemetry chips
  text = text.replace(/\b(\d[\d,]*(?:\.\d+)?\s*(?:rpm|knots|kts|kt|nm|NM|bar|°C|kW|hours|hrs|UTC|DWT|DWT-nm|dwt-nm|gCO[2₂]\/(?:dwt-nm|tnm|MT·NM)|MT\s*CO[2₂]?|MT))\b/gi, '<span class="tabular-nums text-[11px] font-semibold text-foreground bg-muted/60 px-1 py-0.5 rounded border border-border/40">$1</span>')
  return text
}

function parseBulletItem(item: string) {
  const clean = item.replace(/^[\*\-]\s+/, '').replace(/^\d+\.\s+/, '').trim()
  const colonIndex = clean.indexOf(':')
  if (colonIndex > 0 && colonIndex < 50) {
    return {
      label: clean.slice(0, colonIndex).replace(/\*\*/g, '').trim(),
      description: clean.slice(colonIndex + 1).trim(),
    }
  }
  return { label: null, description: clean }
}

function parseTableBlock(lines: string[], startIdx: number) {
  const parseCells = (l: string) =>
    l
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())

  const headers = parseCells(lines[startIdx])
  const sepCells = parseCells(lines[startIdx + 1] || '')
  const alignments: ('left' | 'center' | 'right')[] = sepCells.map((c) => {
    const left = c.startsWith(':')
    const right = c.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    return 'left'
  })

  const rows: string[][] = []
  let curr = startIdx + 2
  while (curr < lines.length && lines[curr].trim().startsWith('|')) {
    rows.push(parseCells(lines[curr]))
    curr++
  }

  return {
    headers,
    alignments,
    rows,
    consumed: curr - startIdx,
  }
}

type ParsedSection =
  | { type: 'assessment_header'; vessel: string; alarm: string; alertTag: string | null }
  | { type: 'conclusion'; title: string; content: string }
  | { type: 'table'; title?: string; headers: string[]; alignments: ('left' | 'center' | 'right')[]; rows: string[][] }
  | { type: 'impact'; title: string; items: Array<{ label: string | null; description: string }> }
  | { type: 'evidence'; title: string; items: Array<{ label: string | null; description: string }> }
  | { type: 'explanations'; title: string; items: Array<{ label: string | null; description: string }> }
  | { type: 'recommendations'; title: string; items: Array<{ label: string | null; description: string }> }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; items: Array<{ label: string | null; description: string }> }
  | { type: 'quote'; text: string }
  | { type: 'paragraph'; text: string }

const parsedSections = computed<ParsedSection[]>(() => {
  const raw = props.block.text || ''
  const lines = raw.split('\n')
  const result: ParsedSection[] = []
  let i = 0

  while (i < lines.length) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed || trimmed === '---') {
      i++
      continue
    }

    // 1. Executive Conclusion heading or callout pattern
    if (/^(##\s*)?(EXECUTIVE CONCLUSION|Executive Summary)/i.test(trimmed)) {
      i++
      const contentLines: string[] = []
      while (i < lines.length) {
        const nextTrim = lines[i].trim()
        if (
          !nextTrim ||
          /^(##|###)/.test(nextTrim) ||
          nextTrim.startsWith('|') ||
          /^(Operational Impact|Confirmed Evidence|Possible Explanations|Recommended)/i.test(nextTrim)
        ) {
          if (!nextTrim && i + 1 < lines.length && lines[i + 1].trim()) {
            const peekTrim = lines[i + 1].trim()
            if (/^(##|###)/.test(peekTrim) || peekTrim.startsWith('|') || /^(Operational Impact|Confirmed Evidence|Possible Explanations|Recommended)/i.test(peekTrim)) {
              break
            }
          } else if (nextTrim) {
            break
          }
        }
        if (nextTrim) contentLines.push(nextTrim)
        i++
      }
      let content = contentLines.join(' ')
      if (content.startsWith('**')) content = content.replace(/^\*\*\s*/, '')
      result.push({
        type: 'conclusion',
        title: 'Executive Conclusion',
        content,
      })
      continue
    }

    // 2. Operational Assessment Header pattern
    if (/Operational Assessment:/i.test(trimmed)) {
      const match = trimmed.match(/Operational Assessment:\s*([^–-]+)\s*[–-]\s*([^(]+)(?:\((Alert\s*#?\d+)\))?/i)
      if (match) {
        result.push({
          type: 'assessment_header',
          vessel: match[1].trim(),
          alarm: match[2].trim(),
          alertTag: match[3] ? match[3].trim() : null,
        })
      }
      i++
      continue
    }

    // 3. Markdown Table: Starts with | and next row has | and ---
    if (trimmed.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|') && lines[i + 1].includes('---')) {
      const table = parseTableBlock(lines, i)
      result.push({
        type: 'table',
        headers: table.headers,
        alignments: table.alignments,
        rows: table.rows,
      })
      i += table.consumed
      continue
    }

    // 4. Operational Impact Section
    if (/^(##\s*)?Operational (&|and)?\s*Financial Impact/i.test(trimmed) || /^(##\s*)?Operational Impact/i.test(trimmed)) {
      const title = trimmed.replace(/^#{1,3}\s+/, '').replace(/^\*\*/, '').replace(/\*\*$/, '')
      i++
      if (i < lines.length && lines[i].trim().startsWith('|')) {
        result.push({ type: 'heading', level: 2, text: title })
        continue
      }
      const items: Array<{ label: string | null; description: string }> = []
      while (i < lines.length && (/^[\*\-]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))) {
        items.push(parseBulletItem(lines[i].trim()))
        i++
      }
      if (items.length) {
        result.push({ type: 'impact', title, items })
      } else {
        result.push({ type: 'heading', level: 2, text: title })
      }
      continue
    }

    // 5. Confirmed Evidence Section
    if (/^(##\s*)?Confirmed (Telemetry (&|and)?\s*)?Evidence/i.test(trimmed)) {
      const title = trimmed.replace(/^#{1,3}\s+/, '').replace(/^\*\*/, '').replace(/\*\*$/, '')
      i++
      const items: Array<{ label: string | null; description: string }> = []
      while (i < lines.length && (/^[\*\-]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))) {
        items.push(parseBulletItem(lines[i].trim()))
        i++
      }
      result.push({ type: 'evidence', title: 'Confirmed Telemetry & Evidence', items })
      continue
    }

    // 6. Recommended Actions Section
    if (/^(##\s*)?(Recommended Checks|Recommended Actions|Next Steps)/i.test(trimmed)) {
      const title = trimmed.replace(/^#{1,3}\s+/, '').replace(/^\*\*/, '').replace(/\*\*$/, '')
      i++
      const items: Array<{ label: string | null; description: string }> = []
      while (i < lines.length && (/^[\*\-]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))) {
        items.push(parseBulletItem(lines[i].trim()))
        i++
      }
      result.push({ type: 'recommendations', title: 'Recommended Verification Checks', items })
      continue
    }

    // 7. Possible Explanations Section
    if (/^(##\s*)?(Possible Explanations|Possible Causes)/i.test(trimmed)) {
      const title = trimmed.replace(/^#{1,3}\s+/, '').replace(/^\*\*/, '').replace(/\*\*$/, '')
      i++
      const items: Array<{ label: string | null; description: string }> = []
      while (i < lines.length && (/^[\*\-]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))) {
        items.push(parseBulletItem(lines[i].trim()))
        i++
      }
      result.push({ type: 'explanations', title: 'Possible Explanations', items })
      continue
    }

    // 8. Headings
    if (trimmed.startsWith('# ')) {
      result.push({ type: 'heading', level: 1, text: trimmed.replace(/^#\s+/, '') })
      i++
      continue
    }
    if (trimmed.startsWith('## ')) {
      result.push({ type: 'heading', level: 2, text: trimmed.replace(/^##\s+/, '') })
      i++
      continue
    }
    if (trimmed.startsWith('### ')) {
      result.push({ type: 'heading', level: 3, text: trimmed.replace(/^###\s+/, '') })
      i++
      continue
    }

    // Standalone title line immediately followed by a markdown table
    if (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
      const title = trimmed.replace(/^\*\*/, '').replace(/\*\*$/, '')
      result.push({ type: 'heading', level: 2, text: title })
      i++
      continue
    }

    // 9. Blockquote / Callout
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''))
        i++
      }
      result.push({ type: 'quote', text: quoteLines.join(' ') })
      continue
    }

    // 10. Bullet List
    if (/^[\*\-]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const items: Array<{ label: string | null; description: string }> = []
      while (i < lines.length && (/^[\*\-]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))) {
        items.push(parseBulletItem(lines[i].trim()))
        i++
      }
      result.push({ type: 'list', items })
      continue
    }

    // 11. Regular Paragraph
    result.push({ type: 'paragraph', text: trimmed })
    i++
  }

  return result
})
</script>

<template>
  <div class="space-y-3 text-xs leading-relaxed">
    <template v-for="(section, sIdx) in parsedSections" :key="sIdx">
      <!-- 1. Operational Assessment Banner Header -->
      <div
        v-if="section.type === 'assessment_header'"
        class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/40 p-2.5 shadow-2xs"
      >
        <div class="flex items-center gap-2 min-w-0">
          <Ship class="size-4 text-primary shrink-0" />
          <span class="font-bold text-foreground truncate">{{ section.vessel }}</span>
          <span class="text-muted-foreground text-[11px]">·</span>
          <span class="text-foreground/90 font-medium truncate">{{ section.alarm }}</span>
        </div>
        <span
          v-if="section.alertTag"
          class="rounded-md bg-primary/10 border border-primary/30 px-1.5 py-0.5 text-[10px] text-primary font-semibold shrink-0"
        >
          {{ section.alertTag }}
        </span>
      </div>

      <!-- 2. Executive Conclusion Callout Card -->
      <div
        v-else-if="section.type === 'conclusion'"
        class="rounded-xl border-l-4 border-l-primary border border-border/80 bg-card p-3.5 space-y-1.5 shadow-xs"
      >
        <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
          <Sparkles class="size-3.5 shrink-0" />
          <span>{{ section.title }}</span>
        </div>
        <p class="text-xs text-foreground font-medium leading-relaxed" v-html="formatInline(section.content)" />
      </div>

      <!-- 3. Formatted Markdown Table -->
      <div
        v-else-if="section.type === 'table'"
        class="overflow-x-auto rounded-xl border border-border/80 bg-card/60 shadow-2xs my-2.5"
      >
        <table class="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr class="border-b border-border/70 bg-muted/50 text-muted-foreground">
              <th
                v-for="(header, hIdx) in section.headers"
                :key="hIdx"
                :class="[
                  'px-3 py-2 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap',
                  section.alignments[hIdx] === 'center' ? 'text-center' : section.alignments[hIdx] === 'right' ? 'text-right' : 'text-left'
                ]"
              >
                <span v-html="formatInline(header)" />
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/40">
            <tr
              v-for="(row, rIdx) in section.rows"
              :key="rIdx"
              class="hover:bg-muted/30 transition-colors"
            >
              <td
                v-for="(cell, cIdx) in row"
                :key="cIdx"
                :class="[
                  'px-3 py-2 text-foreground/90 leading-snug',
                  section.alignments[cIdx] === 'center' ? 'text-center' : section.alignments[cIdx] === 'right' ? 'text-right' : 'text-left'
                ]"
              >
                <span v-html="formatInline(cell)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 4. Operational & Financial Impact Card -->
      <div
        v-else-if="section.type === 'impact'"
        class="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 shadow-2xs"
      >
        <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <AlertTriangle class="size-3.5 shrink-0" />
          <span>{{ section.title }}</span>
        </div>
        <ul class="space-y-1.5">
          <li
            v-for="(item, iIdx) in section.items"
            :key="iIdx"
            class="flex items-start gap-2 text-xs leading-snug"
          >
            <span class="size-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
            <div class="min-w-0 flex-1">
              <span v-if="item.label" class="font-semibold text-foreground mr-1">{{ item.label }}:</span>
              <span class="text-foreground/90" v-html="formatInline(item.description)" />
            </div>
          </li>
        </ul>
      </div>

      <!-- 5. Confirmed Telemetry & Evidence Card -->
      <div
        v-else-if="section.type === 'evidence'"
        class="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-2 shadow-2xs"
      >
        <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          <FileText class="size-3.5 shrink-0" />
          <span>{{ section.title }}</span>
        </div>
        <ul class="space-y-1.5">
          <li
            v-for="(item, iIdx) in section.items"
            :key="iIdx"
            class="flex items-start gap-2 text-xs leading-snug"
          >
            <span class="size-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <div class="min-w-0 flex-1">
              <span v-if="item.label" class="font-semibold text-foreground mr-1">{{ item.label }}:</span>
              <span class="text-foreground/90" v-html="formatInline(item.description)" />
            </div>
          </li>
        </ul>
      </div>

      <!-- 6. Possible Explanations Card -->
      <div
        v-else-if="section.type === 'explanations'"
        class="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2 shadow-2xs"
      >
        <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <HelpCircle class="size-3.5 shrink-0" />
          <span>{{ section.title }}</span>
        </div>
        <ul class="space-y-1.5">
          <li
            v-for="(item, iIdx) in section.items"
            :key="iIdx"
            class="flex items-start gap-2 text-xs leading-snug"
          >
            <span class="size-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
            <div class="min-w-0 flex-1">
              <span v-if="item.label" class="font-semibold text-foreground mr-1">{{ item.label }}:</span>
              <span class="text-foreground/90" v-html="formatInline(item.description)" />
            </div>
          </li>
        </ul>
      </div>

      <!-- 7. Recommended Verification Checks Card -->
      <div
        v-else-if="section.type === 'recommendations'"
        class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2 shadow-2xs"
      >
        <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          <ListChecks class="size-3.5 shrink-0" />
          <span>{{ section.title }}</span>
        </div>
        <ul class="space-y-1.5">
          <li
            v-for="(item, iIdx) in section.items"
            :key="iIdx"
            class="flex items-start gap-2 text-xs leading-snug"
          >
            <CheckCircle2 class="size-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <div class="min-w-0 flex-1">
              <span v-if="item.label" class="font-semibold text-foreground mr-1">{{ item.label }}:</span>
              <span class="text-foreground/90" v-html="formatInline(item.description)" />
            </div>
          </li>
        </ul>
      </div>

      <!-- 8. Headings -->
      <div
        v-else-if="section.type === 'heading'"
        :class="[
          section.level === 1 ? 'font-bold text-sm text-foreground pt-2' : '',
          section.level === 2 ? 'font-bold text-xs uppercase tracking-wider text-foreground pt-2 pb-0.5 flex items-center gap-1.5' : '',
          section.level >= 3 ? 'font-semibold text-xs text-foreground pt-1' : '',
        ]"
      >
        <span v-if="section.level === 2" class="size-1.5 rounded-full bg-primary" />
        <span>{{ section.text }}</span>
      </div>

      <!-- 9. Standalone Bullet List -->
      <ul v-else-if="section.type === 'list'" class="space-y-1 pl-1">
        <li
          v-for="(item, iIdx) in section.items"
          :key="iIdx"
          class="flex items-start gap-2 text-xs leading-snug"
        >
          <span class="size-1 rounded-full bg-primary mt-1.5 shrink-0" />
          <div class="min-w-0 flex-1">
            <span v-if="item.label" class="font-semibold text-foreground mr-1">{{ item.label }}:</span>
            <span class="text-foreground/90" v-html="formatInline(item.description)" />
          </div>
        </li>
      </ul>

      <!-- 10. Callout Blockquote -->
      <div
        v-else-if="section.type === 'quote'"
        class="border-l-2 border-primary/60 bg-muted/30 px-3 py-2 rounded-r-lg text-xs text-foreground/90"
        v-html="formatInline(section.text)"
      />

      <!-- 11. Regular Paragraph -->
      <p
        v-else-if="section.type === 'paragraph'"
        class="text-xs text-foreground/90 leading-relaxed font-normal"
        v-html="formatInline(section.text)"
      />
    </template>
  </div>
</template>
