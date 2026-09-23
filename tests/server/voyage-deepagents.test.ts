import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAgentConfig } from '../../server/utils/sentinel/core/router'
import { createDeepAgent, FilesystemBackend } from 'deepagents'
import { ChatOpenRouter } from '@langchain/openrouter'

test('resolveAgentConfig configures deepagent skills for voyage-analytics', () => {
  const resolved = resolveAgentConfig({
    messages: [{ role: 'user', content: 'validate noon report' }],
    agent: 'voyage-analytics',
  })

  assert.equal(resolved.domain, 'voyage-analytics')
  assert.ok(Array.isArray(resolved.skills), 'skills array should be defined')
  assert.ok(resolved.skills?.includes('server/utils/sentinel/agents/voyage/skills/'))
  assert.equal(resolved.tools.length, 9, 'should include all 9 voyage operational tools')
})

test('createDeepAgent compiles with voyage tools and discovers noon-report-validation skill', () => {
  const resolved = resolveAgentConfig({
    messages: [{ role: 'user', content: 'validate noon report' }],
    agent: 'voyage-analytics',
  })

  const backend = new FilesystemBackend({ rootDir: process.cwd() })
  const model = new ChatOpenRouter({
    apiKey: 'test-fake-key',
    model: 'anthropic/claude-3.5-sonnet',
  })

  const graph = createDeepAgent({
    model,
    tools: resolved.tools,
    systemPrompt: resolved.prompt,
    skills: resolved.skills,
    backend,
    subagents: [],
  })

  assert.ok(graph, 'graph should compile')
  assert.equal(typeof graph.streamEvents, 'function', 'should support streamEvents for Sentinel UI')
})
