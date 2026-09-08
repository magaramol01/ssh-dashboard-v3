<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Sparkles,
  RotateCcw,
  Minimize2,
  Maximize2,
  X,
  Search,
  CornerDownLeft,
  ChevronDown,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SentinelBlockRenderer from '@/components/sentinel/SentinelBlockRenderer.vue'
import type { SentinelAction } from '#shared/types/sentinel'
import { useSentinelChat } from '@/composables/useSentinelChat'

export interface QuickDirective {
  label: string
  query: string
  icon?: any
}

interface Props {
  modelValue: boolean
  fullscreen?: boolean
  title?: string
  subtitle?: string
  badgeText?: string
  quickDirectives?: QuickDirective[]
  activeContext?: Record<string, any>
  placeholder?: string
  initialMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  fullscreen: undefined,
  title: 'Fleet Operations Copilot',
  subtitle: 'AI Marine Intelligence',
  badgeText: 'AI Marine',
  quickDirectives: () => [],
  activeContext: () => ({}),
  placeholder: 'Ask a question, query telemetry, or simulate scenarios...',
  initialMessage: 'Fleet Operations Copilot ready. Ask questions, evaluate performance, or select a directive below.',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:fullscreen': [value: boolean]
  'applyAction': [action: SentinelAction]
}>()

const internalFullscreen = ref(false)
const isFullscreen = computed({
  get: () => props.fullscreen !== undefined ? props.fullscreen : internalFullscreen.value,
  set: (val: boolean) => {
    internalFullscreen.value = val
    emit('update:fullscreen', val)
  },
})

const { messages, isProcessing, input, sendMessage, resetSession } = useSentinelChat(props.initialMessage)

defineExpose({
  askPrompt: (text: string) => handleSend(text),
  reset: handleReset,
  close,
})

function toolLabel(name: string) {
  switch (name) {
    case 'get_vessel_cii_telemetry':
      return 'CII & Emissions Telemetry'
    case 'simulate_vessel_speed_reduction':
      return 'Speed Reduction Hydrodynamic Simulator'
    case 'get_vessel_operational_context':
      return 'Vessel Operational Context'
    case 'analyze_operational_alert':
      return 'Operational Alert Analysis'
    case 'get_fleet_alarm_trends':
      return 'Fleet Alarm Trends'
    case 'get_fleet_voyages':
      return 'Fleet Voyages'
    case 'get_fleet_connectivity':
      return 'Fleet Connectivity'
    default:
      return name.replace(/_/g, ' ')
  }
}

function handleSend(text?: string) {
  const q = text || input.value
  if (!q.trim() || isProcessing.value) return
  sendMessage(q, props.activeContext)
}

function handleReset() {
  resetSession(props.initialMessage)
}

function handleAction(action: SentinelAction) {
  emit('applyAction', action)
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <div>
    <!-- Mobile Backdrop -->
    <Transition name="fade">
      <div
        v-if="modelValue && !isFullscreen"
        class="fixed inset-0 bg-background/60 backdrop-blur-xs z-25 lg:hidden"
        @click="close"
      />
    </Transition>

    <!-- Copilot Drawer / Cockpit -->
    <Transition name="copilot-slide">
      <aside
        v-if="modelValue"
        :class="[
          'copilot-panel bg-card flex flex-col shadow-2xl z-30',
          isFullscreen
            ? 'copilot-fullscreen fixed inset-0 z-50 h-screen w-screen'
            : 'copilot-docked fixed right-0 top-14 bottom-0 z-30 w-full sm:w-[440px] xl:w-[480px] border-l border-border'
        ]"
        role="region"
        :aria-label="title"
      >
        <!-- Copilot Header -->
        <div class="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4 bg-muted/20">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="size-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <Sparkles class="size-4 text-primary" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 leading-none">
                <h2 class="font-semibold text-xs tracking-tight truncate leading-none">{{ title }}</h2>
                <Badge variant="outline" class="text-[9px] font-semibold px-1.5 py-0 border-primary/40 text-primary">
                  {{ badgeText }}
                </Badge>
              </div>
              <p class="text-[10px] text-muted-foreground truncate leading-none mt-1">{{ subtitle }}</p>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Reset Session"
              @click="handleReset"
            >
              <RotateCcw class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-foreground hidden sm:inline-flex cursor-pointer"
              :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
              @click="isFullscreen = !isFullscreen"
            >
              <Minimize2 v-if="isFullscreen" class="size-3.5" />
              <Maximize2 v-else class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Close (Esc)"
              @click="close"
            >
              <X class="size-4" />
            </Button>
          </div>
        </div>

        <!-- Quick Directives Chips -->
        <div v-if="quickDirectives?.length" class="py-2.5 px-3.5 border-b border-border/60 bg-muted/10 shrink-0">
          <div class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
            Quick Directives
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="chip in quickDirectives"
              :key="chip.label"
              type="button"
              class="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded border border-border/80 bg-background hover:border-primary/50 hover:bg-primary/5 text-foreground transition-all cursor-pointer"
              @click="handleSend(chip.query)"
            >
              <component :is="chip.icon" v-if="chip.icon" class="size-3 text-primary shrink-0" />
              <span>{{ chip.label }}</span>
            </button>
          </div>
        </div>

        <!-- Messages Stream -->
        <div class="flex-1 min-h-0 overflow-hidden relative">
          <OverlayScroll class="h-full p-4 space-y-3.5">
            <div v-for="msg in messages" :key="msg.id" class="space-y-2">
              <!-- User Message Bubble -->
              <div v-if="msg.role === 'user'" class="flex justify-end">
                <div class="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium shadow-xs max-w-[85%]">
                  {{ msg.content }}
                </div>
              </div>

              <!-- Copilot Structured Response -->
              <div v-else class="rounded-lg border border-border/80 bg-background/90 p-3 space-y-2.5 shadow-xs">
                <!-- Tool Executions Diagnostic Summary -->
                <div v-if="msg.tools?.length" class="pb-1">
                  <details class="group text-[11px]">
                    <summary class="inline-flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground select-none py-1 px-2 rounded-md bg-muted/40 hover:bg-muted/70 border border-border/50 transition-colors">
                      <span class="text-emerald-500 font-bold">✓</span>
                      <span class="font-medium text-[10px]">{{ msg.tools.length }} diagnostic {{ msg.tools.length === 1 ? 'source' : 'sources' }} verified</span>
                      <ChevronDown class="size-3 text-muted-foreground transition-transform group-open:rotate-180 ml-0.5" />
                    </summary>
                    <div class="mt-1.5 space-y-1 pl-2.5 border-l-2 border-border/70 pt-0.5">
                      <div
                        v-for="(t, idx) in msg.tools"
                        :key="idx"
                        class="flex items-start gap-1.5 text-[10px] text-muted-foreground"
                      >
                        <span class="text-foreground font-semibold shrink-0">{{ toolLabel(t.name) }}:</span>
                        <span class="opacity-80 leading-tight">{{ t.summary }}</span>
                      </div>
                    </div>
                  </details>
                </div>

                <!-- Blocks Renderer -->
                <div v-if="msg.blocks?.length" class="space-y-2.5">
                  <SentinelBlockRenderer v-for="(block, idx) in msg.blocks" :key="`${msg.id}-block-${idx}`" :block="block" />
                </div>
                <p v-else class="text-xs text-foreground leading-relaxed whitespace-pre-line">{{ msg.content }}</p>

                <!-- Interactive Actions -->
                <div v-if="msg.actions?.length" class="pt-1.5 border-t border-border/40 flex flex-wrap gap-1.5">
                  <Button
                    v-for="act in msg.actions"
                    :key="act.label"
                    variant="outline"
                    size="sm"
                    class="h-6 text-[11px] font-medium px-2 py-0 border-primary/40 hover:bg-primary/10 text-foreground cursor-pointer gap-1 transition-colors"
                    @click="handleAction(act.action)"
                  >
                    <ArrowUpRight class="size-2.5 text-primary shrink-0" />
                    <span>{{ act.label }}</span>
                  </Button>
                </div>
              </div>
            </div>

            <!-- Processing Spinner -->
            <div v-if="isProcessing" class="flex items-center gap-2 text-xs text-muted-foreground p-2.5 rounded border border-border/50 bg-muted/20">
              <RefreshCw class="size-3 text-primary animate-spin" />
              <span>Analyzing marine intelligence and telemetry...</span>
            </div>
          </OverlayScroll>
        </div>

        <!-- Command Input Footer -->
        <div class="border-t border-border/80 bg-muted/20 p-3 shrink-0">
          <form class="flex items-center gap-2" @submit.prevent="handleSend()">
            <div class="relative flex-1">
              <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                v-model="input"
                :placeholder="placeholder"
                class="h-8 pl-8 pr-7 text-xs border-border/80 bg-background"
                :disabled="isProcessing"
              />
              <button
                v-if="input"
                type="button"
                class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                @click="input = ''"
              >
                <X class="size-3" />
              </button>
            </div>
            <Button
              type="submit"
              size="sm"
              class="h-8 px-2.5 text-xs gap-1 cursor-pointer shrink-0"
              :disabled="!input.trim() || isProcessing"
            >
              <span>Ask</span>
              <CornerDownLeft class="size-3" />
            </Button>
          </form>
          <div class="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 px-0.5">
            <span>Powered by OpenRouter & LangChain</span>
            <span class="font-mono text-[9px]">Esc to close</span>
          </div>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.copilot-slide-enter-active,
.copilot-slide-leave-active {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease;
}

.copilot-slide-enter-from,
.copilot-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
