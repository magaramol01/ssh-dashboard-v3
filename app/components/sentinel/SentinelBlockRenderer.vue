<script setup lang="ts">
import { computed } from 'vue'
import type { SentinelBlock } from '#shared/types/sentinel'
import { sentinelBlockRegistry } from './registry'

const props = defineProps<{ block: SentinelBlock }>()
const component = computed(() => sentinelBlockRegistry[props.block.type])
</script>

<template>
  <component :is="component" :block="block" />
</template>
