<script setup lang="ts">
import { onMounted } from 'vue';
import { useScenariosStore } from './stores/scenarios';
import AppHeader from './components/AppHeader.vue';
import ScenarioList from './components/ScenarioList.vue';
import ScenarioPane from './components/ScenarioPane.vue';
import MobileScenarioTabs from './components/MobileScenarioTabs.vue';
import SweepChart from './components/SweepChart.vue';
import { useMediaQuery } from './lib/useMediaQuery';

const store = useScenariosStore();

// Switch the panes region between desktop grid and mobile single-pane + tabs.
// The chart is shared by both layouts (rendered once below).
const isDesktop = useMediaQuery('(min-width: 768px)');

onMounted(() => {
  store.loadFromHash();
});
</script>

<template>
  <div class="min-h-full p-4 md:p-8">
    <div
      class="mx-auto flex max-w-[1280px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
    >
      <AppHeader />

      <div
        v-if="store.loadError"
        role="alert"
        class="mx-6 mt-4 flex items-start justify-between gap-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <span>{{ store.loadError }} Falling back to example scenarios.</span>
        <button
          type="button"
          class="shrink-0 rounded px-2 py-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/40"
          aria-label="Dismiss"
          @click="store.dismissLoadError()"
        >
          <FontAwesomeIcon icon="xmark" />
        </button>
      </div>

      <ScenarioList v-if="isDesktop" />
      <template v-else>
        <MobileScenarioTabs />
        <ScenarioPane :index="store.activeScenarioIndex" />
      </template>

      <div class="border-t border-neutral-200 p-4 md:p-6 dark:border-neutral-800">
        <SweepChart />
      </div>

      <footer
        class="border-t border-neutral-200 px-6 py-4 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"
      >
        MIT · engine is zero-dep TS · bands cited from official sources per region file
      </footer>
    </div>
  </div>
</template>
