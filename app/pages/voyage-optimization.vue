<script setup lang="ts">
definePageMeta({ middleware: 'require-dispatcher' })
await navigateTo('/voyage-analytics', { replace: true })
</script>

<template>
  <div class="flex items-center justify-center min-h-[400px]">
    <p class="text-sm text-muted-foreground">Redirecting to Voyage Analytics...</p>
  </div>
</template>
