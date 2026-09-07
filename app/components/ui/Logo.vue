<script setup lang="ts">
/**
 * Smart Ship Hub brand mark — a simple ship silhouette. One `currentColor`
 * glyph keeps it readable on the primary-tinted tile in the sidebar header and
 * sign-in card, scaling cleanly from the collapsed rail up.
 */
const props = defineProps<{
  class?: string
}>()
</script>

<template>
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :class="props.class"
    aria-hidden="true"
  >
    <!-- Ship and cabin -->
    <path d="M4 18H28L24.5 24H7.5L4 18Z" fill="currentColor" />
    <path d="M8 18V12H21V18M12 12V8H21V12M16 8V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Water -->
    <path d="M3 27C5 25.7 7 25.7 9 27C11 28.3 13 28.3 15 27C17 25.7 19 25.7 21 27C23 28.3 25 28.3 29 26.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  </svg>
</template>
