<script setup lang="ts">
import { computed } from 'vue'
import {
  Ship, Activity, AlertTriangle, FileText, CheckCircle2, HelpCircle, ListChecks, ShieldAlert
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
  // Bold
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
  // Inline code / telemetry
  text = text.replace(/`([^`]+)`/g, '<code class="font-mono text-[10px] bg-muted/80 text-primary px-1 py-0.5 rounded border border-border/50 font-medium">$1</code>')
  // Telemetry values: e.g. "0 rpm", "0 knots", "0 kt", "6 hours", "18:34:21 UTC"
  text = text.replace(/\b(\d+(?:\.\d+)?\s*(?:rpm|knots|kt|nm|bar|°C|kW|hours|hrs|UTC))\b/gi, '<span class="tabular-nums text-[11px] font-semibold text-foreground bg-muted/60 px-1 py-0.5 rounded border border-border/40">$1</span>')
  return text
}

function parseBulletItem(item: string) {
  const clean = item.replace(/^[\*\-]\s+/, '').trim()
  const colonIndex = clean.indexOf(':')
  if (colonIndex > 0 && colonIndex < 45) {
    return {
      label: clean.slice(0, colonIndex).replace(/\*\*/g, '').trim(),
      description: clean.slice(colonIndex + 1).trim(),
    }
  }
  return { label: null, description: clean }
}

type ParsedSection =
  | { type: 'assessment_header'; vessel: string; alarm: string; alertTag: string | null }
  | { type: 'conclusion'; title: string; content: string }
  | { type: 'impact'; title: string; items: Array<{ label: string | null; description: string }> }
  | { type: 'evidence'; title: string; items: Array<{ label: string | null; description: string }> }
  | { type: 'explanations'; title: string; items: Array<{ label: string | null; description: string }> }
  | { type: 'recommendations'; title: string; items: Array<{ label: string | null; description: string }> }
  | { type: 'general'; lines: string[] }

const parsedSections = computed<ParsedSection[]>(() => {
  const raw = props.block.text || ''
  const chunks = raw.split(/\n\s*---\s*\n/)
  const result: ParsedSection[] = []

  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (!trimmed) continue

    // Operational Assessment Header + Conclusion pattern
    if (/Operational Assessment:/i.test(trimmed)) {
      const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean)
      const titleLine = lines[0] || ''
      const match = titleLine.match(/Operational Assessment:\s*([^–-]+)\s*[–-]\s*([^(]+)(?:\((Alert\s*#?\d+)\))?/i)
      if (match) {
        result.push({
          type: 'assessment_header',
          vessel: match[1].trim(),
          alarm: match[2].trim(),
          alertTag: match[3] ? match[3].trim() : null,
        })
      }

      const conclusionIndex = trimmed.indexOf('Conclusion:')
      if (conclusionIndex !== -1) {
        const conclusionText = trimmed.slice(conclusionIndex + 'Conclusion:'.length).trim()
        result.push({
          type: 'conclusion',
          title: 'Executive Conclusion',
          content: conclusionText,
        })
      }
      continue
    }

    // Operational Impact Section
    if (/^Operational Impact/im.test(trimmed)) {
      const content = trimmed.replace(/^Operational Impact\s*/i, '').trim()
      const rawItems = content.split(/\n\s*[\*\-]\s+/).map(x => x.trim()).filter(Boolean)
      result.push({
        type: 'impact',
        title: 'Operational Impact',
        items: rawItems.map(parseBulletItem),
      })
      continue
    }

    // Confirmed Evidence Section
    if (/^Confirmed Evidence/im.test(trimmed)) {
      const content = trimmed.replace(/^Confirmed Evidence\s*/i, '').trim()
      const rawItems = content.split(/\n\s*[\*\-]\s+/).map(x => x.trim()).filter(Boolean)
      result.push({
        type: 'evidence',
        title: 'Confirmed Telemetry & Evidence',
        items: rawItems.map(parseBulletItem),
      })
      continue
    }

    // Possible Explanations Section
    if (/^(Possible Explanations|Possible Causes)/im.test(trimmed)) {
      const content = trimmed.replace(/^(Possible Explanations|Possible Causes)\s*/i, '').trim()
      const rawItems = content.split(/\n\s*[\*\-]\s+/).map(x => x.trim()).filter(Boolean)
      result.push({
        type: 'explanations',
        title: 'Possible Explanations',
        items: rawItems.map(parseBulletItem),
      })
      continue
    }

    // Recommended Checks Section
    if (/^(Recommended Checks|Recommended Actions|Next Steps)/im.test(trimmed)) {
      const content = trimmed.replace(/^(Recommended Checks|Recommended Actions|Next Steps)\s*/i, '').trim()
      const rawItems = content.split(/\n\s*[\*\-]\s+/).map(x => x.trim()).filter(Boolean)
      result.push({
        type: 'recommendations',
        title: 'Recommended Verification Checks',
        items: rawItems.map(parseBulletItem),
      })
      continue
    }

    // General Fallback
    const lines = trimmed.split('\n')
    result.push({
      type: 'general',
      lines,
    })
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
        class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/40 p-2.5"
      >
        <div class="flex items-center gap-2 min-w-0">
          <Ship class="size-4 text-primary shrink-0" />
          <span class="font-bold text-foreground truncate">{{ section.vessel }}</span>
          <span class="text-muted-foreground text-[11px]">·</span>
          <span class="text-foreground/90 font-medium truncate">{{ section.alarm }}</span>
        </div>
        <span
          v-if="section.alertTag"
          class="rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 text-[10px] text-primary font-semibold shrink-0"
        >
          {{ section.alertTag }}
        </span>
      </div>

      <!-- 2. Executive Conclusion Callout -->
      <div
        v-else-if="section.type === 'conclusion'"
        class="rounded-lg border-l-3 border-l-primary border border-border/70 bg-card p-3 space-y-1.5 shadow-2xs"
      >
        <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <Activity class="size-3.5 shrink-0" />
          <span>{{ section.title }}</span>
        </div>
        <p class="text-xs text-foreground font-medium leading-relaxed" v-html="formatInline(section.content)" />
      </div>

      <!-- 3. Operational Impact Card -->
      <div
        v-else-if="section.type === 'impact'"
        class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 shadow-2xs"
      >
        <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-500">
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

      <!-- 4. Confirmed Telemetry & Evidence Card -->
      <div
        v-else-if="section.type === 'evidence'"
        class="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-2 shadow-2xs"
      >
        <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-500 dark:text-blue-400">
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

      <!-- 5. Possible Explanations Card -->
      <div
        v-else-if="section.type === 'explanations'"
        class="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2 shadow-2xs"
      >
        <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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

      <!-- 6. Recommended Verification Checks Card -->
      <div
        v-else-if="section.type === 'recommendations'"
        class="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2 shadow-2xs"
      >
        <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
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

      <!-- 7. General Fallback Paragraphs & Lists -->
      <div v-else-if="section.type === 'general'" class="space-y-1.5">
        <template v-for="(line, lIdx) in section.lines" :key="lIdx">
          <div
            v-if="line.startsWith('# ')"
            class="font-bold text-sm text-foreground pt-1"
          >
            {{ line.replace(/^#\s+/, '') }}
          </div>
          <div
            v-else-if="line.startsWith('## ')"
            class="font-semibold text-xs text-foreground uppercase tracking-wider pt-1"
          >
            {{ line.replace(/^##\s+/, '') }}
          </div>
          <div
            v-else-if="line.startsWith('### ')"
            class="font-semibold text-xs text-foreground pt-0.5"
          >
            {{ line.replace(/^###\s+/, '') }}
          </div>
          <div
            v-else-if="line.startsWith('* ') || line.startsWith('- ')"
            class="flex items-start gap-2 text-xs pl-1 leading-snug"
          >
            <span class="size-1 rounded-full bg-primary mt-1.5 shrink-0" />
            <span class="text-foreground/90" v-html="formatInline(line.replace(/^[\*\-]\s+/, ''))" />
          </div>
          <p
            v-else-if="line.trim()"
            class="text-xs text-foreground/90 leading-relaxed"
            v-html="formatInline(line)"
          />
        </template>
      </div>
    </template>
  </div>
</template>
