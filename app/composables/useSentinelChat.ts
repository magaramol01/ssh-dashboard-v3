import { ref } from 'vue'
import type { SentinelAction, SentinelAgentDomain, SentinelBlock, SentinelChatResponse } from '#shared/types/sentinel'

export interface SentinelMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  thought?: string
  blocks?: SentinelBlock[]
  tools?: { name: string; args: string; rawArgs?: Record<string, unknown>; summary: string }[]
  actions?: { label: string; action: SentinelAction }[]
}

export function useSentinelChat(initialMessage?: string, defaultAgent?: SentinelAgentDomain) {
  const isProcessing = ref(false)
  const activeTool = ref<string | null>(null)
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

  async function sendMessage(promptText: string, context?: Record<string, any>, agent?: SentinelAgentDomain) {
    const q = promptText.trim()
    if (!q || isProcessing.value) return
    input.value = ''
    messages.value.push({ id: `user-${Date.now()}`, role: 'user', content: q })
    isProcessing.value = true
    activeTool.value = null

    const agentMsg: SentinelMessage = {
      id: `agent-${Date.now()}`,
      role: 'agent',
      content: '',
      blocks: [],
      tools: [],
      actions: [],
    }
    messages.value.push(agentMsg)

    try {
      const res = await fetch('/api/sentinel/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          agent: agent || defaultAgent,
          stream: true,
          messages: messages.value
            .filter((m) => m.id !== agentMsg.id)
            .slice(-20)
            .map(({ role, content }) => ({
              role: role === 'agent' ? 'assistant' : 'user',
              content,
            })),
          context,
        }),
      })

      if (!res.ok) {
        let errMessage = 'Copilot is temporarily unavailable.'
        try {
          const errData = await res.json()
          errMessage = errData.message || errData.statusMessage || errMessage
        } catch {}
        agentMsg.content = errMessage
        return
      }

      if (res.headers.get('content-type')?.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          let currentEvent = 'message'
          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.slice(6).trim()
            } else if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim()
              if (!dataStr) continue
              try {
                const data = JSON.parse(dataStr)
                if (currentEvent === 'token') {
                  agentMsg.content += data.token || ''
                } else if (currentEvent === 'tool_start') {
                  activeTool.value = data.name || null
                } else if (currentEvent === 'tool_end') {
                  activeTool.value = null
                  if (!agentMsg.tools) agentMsg.tools = []
                  agentMsg.tools.push({
                    name: data.name,
                    args: '{}',
                    summary: data.summary,
                  })
                } else if (currentEvent === 'thought') {
                  agentMsg.thought = (agentMsg.thought ? agentMsg.thought + '\n' : '') + (data.text || '')
                } else if (currentEvent === 'final') {
                  agentMsg.content = data.message?.content || agentMsg.content
                  agentMsg.thought = data.thought || agentMsg.thought
                  agentMsg.blocks = data.blocks || []
                  agentMsg.tools = (data.activity || []).map((a: any) => ({
                    name: a.name,
                    args: typeof a.args === 'string' ? a.args : JSON.stringify(a.args),
                    rawArgs: typeof a.args === 'object' && a.args !== null ? a.args : undefined,
                    summary: a.summary,
                  }))
                  agentMsg.actions = (data.actions || []).map((action: any) => ({
                    label: action.label,
                    action,
                  }))
                } else if (currentEvent === 'error') {
                  agentMsg.content = data.message || 'An error occurred during generation.'
                }
              } catch {}
            }
          }
        }
      } else {
        const data: SentinelChatResponse = await res.json()
        agentMsg.content = data.message.content
        agentMsg.thought = data.thought
        agentMsg.blocks = data.blocks
        agentMsg.tools = data.activity.map((a) => ({
          name: a.name,
          args: typeof a.args === 'string' ? a.args : JSON.stringify(a.args),
          rawArgs: typeof a.args === 'object' && a.args !== null ? (a.args as Record<string, unknown>) : undefined,
          summary: a.summary,
        }))
        agentMsg.actions = data.actions.map((action) => ({
          label: action.label,
          action,
        }))
      }
    } catch (err: any) {
      agentMsg.content = err?.message || 'Copilot is temporarily unavailable.'
    } finally {
      activeTool.value = null
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
    activeTool,
    input,
    sendMessage,
    resetSession,
  }
}
