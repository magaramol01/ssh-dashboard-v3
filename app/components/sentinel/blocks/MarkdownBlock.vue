<script setup lang="ts">
import { computed } from 'vue'
import type { SentinelBlock } from '#shared/types/sentinel'

type MarkdownBlock = Extract<SentinelBlock, { type: 'markdown' }>
const props = defineProps<{ block: MarkdownBlock }>()

const plainText = computed(() => props.block.text
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/__(.*?)__/g, '$1')
  .replace(/`([^`]+)`/g, '$1'))
</script>

<template>
  <p class="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{{ plainText }}</p>
</template>
