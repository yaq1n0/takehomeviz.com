<script setup lang="ts">
import { computed } from 'vue';
import { useScenariosStore } from '../stores/scenarios';

const store = useScenariosStore();

const MAX_SCENARIOS = 12;

const canAdd = computed(() => store.scenarios.length < MAX_SCENARIOS);

function labelFor(index: number): string {
  const s = store.scenarios[index];
  if (!s) return '';
  return `${index + 1}. ${s.name ?? s.regionId}`;
}
</script>

<template>
  <div
    class="flex items-center justify-center gap-1 px-4 py-3 overflow-x-auto"
    role="tablist"
    aria-label="Scenarios"
  >
    <button
      v-for="(s, i) in store.scenarios"
      :key="i"
      type="button"
      role="tab"
      :aria-selected="store.activeScenarioIndex === i"
      class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
      :class="
        store.activeScenarioIndex === i
          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
          : 'border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
      "
      @click="store.setActiveScenarioIndex(i)"
    >
      {{ labelFor(i) }}
    </button>
    <button
      type="button"
      class="px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-medium whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
      :disabled="!canAdd"
      aria-label="Add scenario"
      @click="store.addScenario()"
    >
      <FontAwesomeIcon icon="plus" />
    </button>
  </div>
</template>
