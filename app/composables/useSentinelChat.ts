import { ref } from 'vue'
import type { SentinelAction, SentinelBlock, SentinelChatResponse } from '#shared/types/sentinel'

export interface SentinelMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  blocks?: SentinelBlock[]
  tools?: { name: string; args: string; summary: string }[]
  actions?: { label: string; action: SentinelAction }[]
}

export function useSentinelChat(initialMessage?: string) {
  const isProcessing = ref(false)
  const input = ref('')
  const messages = ref<SentinelMessage[]>([
    {
      id: 'sentinel-ready',
      role: 'agent',
      content:
        initialMessage ||
        'Fleet Operations Copilot ready. Ask operational questions, evaluate performance, or select a directive below.',
    },
  ])

  async function sendMessage(promptText: string, context?: Record<string, any>) {
    const q = promptText.trim()
    if (!q || isProcessing.value) return
    input.value = ''
    messages.value.push({ id: `user-${Date.now()}`, role: 'user', content: q })
    isProcessing.value = true

    try {
      const response = await $fetch<SentinelChatResponse>('/api/sentinel/chat', {
        method: 'POST',
        body: {
          messages: messages.value.slice(-20).map(({ role, content }) => ({
            role: role === 'agent' ? 'assistant' : 'user',
            content,
          })),
          context,
        },
      })
      messages.value.push({
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: response.message.content,
        blocks: response.blocks,
        tools: response.activity.map(({ name, args, summary }) => ({
          name,
          args: typeof args === 'string' ? args : JSON.stringify(args),
          summary,
        })),
        actions: response.actions.map((action) => ({
          label: action.label,
          action,
        })),
      })
    } catch (err: any) {
      messages.value.push({
        id: `agent-err-${Date.now()}`,
        role: 'agent',
        content: err?.data?.message || err?.message || 'Copilot is temporarily unavailable.',
      })
    } finally {
      isProcessing.value = false
    }
  }

  function resetSession(welcomeMessage?: string) {
    messages.value = [
      {
        id: `sentinel-${Date.now()}`,
        role: 'agent',
        content: welcomeMessage || 'Session refreshed. Ready for operational queries.',
      },
    ]
    input.value = ''
    isProcessing.value = false
  }

  return {
    messages,
    isProcessing,
    input,
    sendMessage,
    resetSession,
  }
}
