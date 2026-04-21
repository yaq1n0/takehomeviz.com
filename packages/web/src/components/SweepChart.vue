<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import uPlot from 'uplot';
import type { Options, AlignedData } from 'uplot';
import { useScenariosStore } from '../stores/scenarios';
import { findCrossovers, type Crossover } from '../lib/crossovers';
import { formatCompact, formatNumber, moneyToDisplay } from '../lib/format';

const store = useScenariosStore();

const container = ref<HTMLDivElement | null>(null);
const plot = shallowRef<uPlot | null>(null);

// Fixed 12-color qualitative palette, shared across light/dark themes.
// Max scenarios is 12, so the modulo in colorFor() is defensive only.
const PALETTE = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#ea580c', // orange
  '#9333ea', // purple
  '#0891b2', // cyan
  '#db2777', // pink
  '#ca8a04', // amber
  '#0d9488', // teal
  '#7c3aed', // violet
  '#65a30d', // lime
  '#e11d48', // rose
];

const isDark = ref<boolean>(
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
);
let themeObserver: MutationObserver | null = null;

function currencySymbol(c: 'GBP' | 'USD'): string {
  return c === 'GBP' ? '£' : '$';
}

function colorFor(i: number): string {
  return PALETTE[i % PALETTE.length] ?? '#334155';
}

const data = computed<AlignedData>(() => {
  const { xs, series } = store.sweepSeries;
  const rows: AlignedData = [
    xs,
    ...series.map((arr) => arr.map((v) => (v == null ? null : v))),
  ] as AlignedData;
  return rows;
});

const crossovers = computed<Crossover[]>(() => {
  const { xs, series } = store.sweepSeries;
  return findCrossovers(xs, series);
});

const currentPoints = computed(() => {
  const fx = store.fxConfig;
  return store.breakdowns.map((b) => ({
    x: moneyToDisplay(b.gross, fx),
    y: moneyToDisplay(b.spendable, fx),
  }));
});

const legendChips = computed(() =>
  store.scenarios.map((s, i) => ({
    label: `${i + 1}. ${s.name ?? s.regionId}`,
    color: colorFor(i),
  })),
);

function scenarioLabel(i: number): string {
  const s = store.scenarios[i];
  if (!s) return `#${i + 1}`;
  return `${i + 1}. ${s.name ?? s.regionId}`;
}

// Dual-slider range selector.
// Stops: 0-100k in 10k increments, then 100k-1M in 100k increments.
// Handles at the outer extremes (0 and MAX_IDX) mean "auto" on that side;
// when both are at extremes we clear the range (null) and let the engine pick.
const STOPS: readonly number[] = [
  0, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000, 70_000, 80_000, 90_000, 100_000, 200_000,
  300_000, 400_000, 500_000, 600_000, 700_000, 800_000, 900_000, 1_000_000,
] as const;
const MAX_IDX = STOPS.length - 1;

function valueToIdx(v: number | undefined, fallback: number): number {
  if (v == null) return fallback;
  // Snap to nearest stop.
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < STOPS.length; i += 1) {
    const d = Math.abs((STOPS[i] as number) - v);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

const minIdx = ref<number>(valueToIdx(store.chartRange?.minMajor, 0));
const maxIdx = ref<number>(valueToIdx(store.chartRange?.maxMajor, MAX_IDX));

watch(
  () => store.chartRange,
  (cr) => {
    minIdx.value = valueToIdx(cr?.minMajor, 0);
    maxIdx.value = valueToIdx(cr?.maxMajor, MAX_IDX);
  },
);

const isAuto = computed(() => minIdx.value === 0 && maxIdx.value === MAX_IDX);
const minLabel = computed(() =>
  minIdx.value === 0 ? 'auto' : formatCompact(STOPS[minIdx.value] as number, store.displayCurrency),
);
const maxLabel = computed(() =>
  maxIdx.value === MAX_IDX
    ? 'auto'
    : formatCompact(STOPS[maxIdx.value] as number, store.displayCurrency),
);

const fillStyle = computed(() => {
  const left = (minIdx.value / MAX_IDX) * 100;
  const right = 100 - (maxIdx.value / MAX_IDX) * 100;
  return { left: `${left}%`, right: `${right}%` };
});

function commitRange(): void {
  if (minIdx.value === 0 && maxIdx.value === MAX_IDX) {
    store.setChartRange(null);
  } else {
    store.setChartRange({
      minMajor: STOPS[minIdx.value] as number,
      maxMajor: STOPS[maxIdx.value] as number,
    });
  }
}

function onMinSlide(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  minIdx.value = Math.min(v, maxIdx.value - 1);
  commitRange();
}
function onMaxSlide(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  maxIdx.value = Math.max(v, minIdx.value + 1);
  commitRange();
}
function resetRange(): void {
  minIdx.value = 0;
  maxIdx.value = MAX_IDX;
  store.setChartRange(null);
}

function buildOpts(width: number, height: number): Options {
  const displayCurrency = store.displayCurrency;
  const dark = isDark.value;
  const gridStroke = dark ? '#1e293b' : '#f1f5f9';
  const axisStroke = dark ? '#334155' : '#cbd5e1';
  const tickLabel = dark ? '#94a3b8' : '#64748b';

  const seriesDefs = store.scenarios.map((s, i) => ({
    label: `${i + 1}. ${s.name ?? s.regionId}`,
    stroke: colorFor(i),
    width: 2,
    points: { show: false },
  }));
  const pts = currentPoints.value;
  const xovers = crossovers.value;

  return {
    width,
    height,
    scales: { x: { time: false } },
    axes: [
      {
        stroke: tickLabel,
        grid: { stroke: gridStroke, width: 1 },
        ticks: { stroke: axisStroke },
        values: (_u, ticks) => ticks.map((t) => formatCompact(t, displayCurrency)),
        label: `Gross annual (${displayCurrency})`,
      },
      {
        stroke: tickLabel,
        grid: { stroke: gridStroke, width: 1 },
        ticks: { stroke: axisStroke },
        values: (_u, ticks) => ticks.map((t) => formatCompact(t, displayCurrency)),
        label: `Spendable annual (${displayCurrency})`,
      },
    ],
    series: [{ label: `Gross (${displayCurrency})` }, ...seriesDefs],
    hooks: {
      draw: [
        (u) => {
          const ctx = u.ctx;
          ctx.save();
          const scenarioMarkerStroke = dark ? '#0a0a0a' : '#ffffff';
          const crossoverFill = dark ? '#f1f5f9' : '#111827';
          const crossoverLabelFill = dark ? '#f1f5f9' : '#111827';
          // Current-gross markers.
          pts.forEach((p, i) => {
            const cx = u.valToPos(p.x, 'x', true);
            const cy = u.valToPos(p.y, 'y', true);
            if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
            ctx.beginPath();
            ctx.arc(cx, cy, 5, 0, Math.PI * 2);
            ctx.fillStyle = colorFor(i);
            ctx.strokeStyle = scenarioMarkerStroke;
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
          });
          // Crossover markers — diamond + label on the first few only.
          xovers.forEach((x, idx) => {
            const cx = u.valToPos(x.gross, 'x', true);
            const cy = u.valToPos(x.spendable, 'y', true);
            if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
            ctx.beginPath();
            ctx.moveTo(cx, cy - 6);
            ctx.lineTo(cx + 6, cy);
            ctx.lineTo(cx, cy + 6);
            ctx.lineTo(cx - 6, cy);
            ctx.closePath();
            ctx.fillStyle = crossoverFill;
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
            if (idx < 6) {
              ctx.fillStyle = crossoverLabelFill;
              ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
              ctx.fillText(
                `${scenarioLabel(x.a)} × ${scenarioLabel(x.b)} @ ${formatCompact(x.gross, displayCurrency)}`,
                cx + 12,
                cy - 8,
              );
            }
          });
          ctx.restore();
        },
      ],
    },
  };
}

function mount(): void {
  if (!container.value) return;
  const rect = container.value.getBoundingClientRect();
  const opts = buildOpts(Math.max(300, Math.floor(rect.width)), chartHeight());
  plot.value = new uPlot(opts, data.value, container.value);
}

function remount(): void {
  if (plot.value) {
    plot.value.destroy();
    plot.value = null;
  }
  mount();
}

const isFullscreen = ref(false);

function chartHeight(): number {
  if (!isFullscreen.value) return 320;
  if (typeof window === 'undefined') return 320;
  // Leave room for the card's toolbar, caption, and crossover list.
  return Math.max(320, Math.floor(window.innerHeight - 360));
}

function resize(): void {
  if (!container.value || !plot.value) return;
  const rect = container.value.getBoundingClientRect();
  plot.value.setSize({
    width: Math.max(300, Math.floor(rect.width)),
    height: chartHeight(),
  });
}

async function toggleFullscreen(): Promise<void> {
  isFullscreen.value = !isFullscreen.value;
  await nextTick();
  requestAnimationFrame(() => resize());
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false;
    nextTick(() => requestAnimationFrame(() => resize()));
  }
}

// Lock body scroll while fullscreen so the teleported overlay is the only scroll context.
watch(isFullscreen, (v) => {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = v ? 'hidden' : '';
});

onMounted(() => {
  mount();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeydown);
  if (typeof document !== 'undefined') {
    themeObserver = new MutationObserver(() => {
      const nextDark = document.documentElement.classList.contains('dark');
      if (nextDark !== isDark.value) isDark.value = nextDark;
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  window.removeEventListener('keydown', onKeydown);
  if (typeof document !== 'undefined') document.body.style.overflow = '';
  plot.value?.destroy();
  plot.value = null;
  themeObserver?.disconnect();
  themeObserver = null;
});

// Series count can change (add/remove scenario) → rebuild uPlot options.
watch(
  () => store.scenarios.length,
  () => remount(),
);

// Display currency change also changes axis labels → rebuild.
watch(
  () => store.displayCurrency,
  () => remount(),
);

// Theme change → rebuild to swap palettes.
watch(isDark, () => remount());

// Otherwise, hot-update data in place.
watch(
  [data, currentPoints, crossovers],
  () => {
    if (plot.value) plot.value.setData(data.value);
  },
  { deep: true },
);

const crossoverList = computed(() =>
  crossovers.value.map((c) => ({
    pair: `${scenarioLabel(c.a)} × ${scenarioLabel(c.b)}`,
    at: formatNumber(c.gross, store.displayCurrency),
    spend: formatNumber(c.spendable, store.displayCurrency),
  })),
);

const symbol = computed(() => currencySymbol(store.displayCurrency));
</script>

<template>
  <Teleport to="body" :disabled="!isFullscreen">
    <div
      :class="
        isFullscreen
          ? 'fixed left-0 top-0 z-[100] h-screen w-screen overflow-auto bg-white p-4 dark:bg-neutral-950 sm:p-6'
          : 'relative rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950'
      "
      data-testid="chart-card"
    >
      <!-- Fullscreen toggle -->
      <button
        type="button"
        class="absolute right-3 top-3 z-10 rounded p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        :title="isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'"
        :aria-label="isFullscreen ? 'Exit fullscreen chart' : 'Enter fullscreen chart'"
        data-testid="chart-fullscreen-toggle"
        @click="toggleFullscreen"
      >
        <FontAwesomeIcon :icon="isFullscreen ? 'compress' : 'expand'" class="text-[13px]" />
      </button>

      <!-- Toolbar -->
      <div class="mb-4 space-y-3 text-center">
        <div>
          <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Spending power across gross range
          </h2>
          <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Monthly after expenses, in primary currency ({{ symbol }})
          </p>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
          <span
            v-for="(chip, i) in legendChips"
            :key="i"
            class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300"
          >
            <span
              class="inline-block h-2 w-2 rounded-full"
              :style="{ backgroundColor: chip.color }"
            />
            <span>{{ chip.label }}</span>
          </span>
        </div>
        <div class="flex justify-center">
          <div
            class="flex w-full max-w-md items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs sm:gap-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <span
              class="tabular-nums font-mono shrink-0 text-right text-neutral-600 dark:text-neutral-300"
              >{{ minLabel }}</span
            >
            <div class="dual-range relative h-5 min-w-0 flex-1">
              <div
                class="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-neutral-200 dark:bg-neutral-800"
              />
              <div
                class="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-500"
                :style="fillStyle"
              />
              <input
                type="range"
                min="0"
                :max="MAX_IDX"
                step="1"
                :value="minIdx"
                :aria-label="`Chart range minimum (${minLabel})`"
                @input="onMinSlide"
              />
              <input
                type="range"
                min="0"
                :max="MAX_IDX"
                step="1"
                :value="maxIdx"
                :aria-label="`Chart range maximum (${maxLabel})`"
                @input="onMaxSlide"
              />
            </div>
            <span
              class="tabular-nums font-mono shrink-0 text-left text-neutral-600 dark:text-neutral-300"
              >{{ maxLabel }}</span
            >
            <button
              type="button"
              class="ml-0.5 text-neutral-500 transition-colors hover:text-neutral-700 disabled:opacity-40 disabled:hover:text-neutral-500 dark:text-neutral-400 dark:hover:text-neutral-200"
              :disabled="isAuto"
              title="Reset to auto"
              aria-label="Reset chart range to auto"
              @click="resetRange"
            >
              <FontAwesomeIcon icon="rotate-left" class="text-[11px]" />
            </button>
          </div>
        </div>
      </div>

      <!-- Chart -->
      <div ref="container" class="w-full min-h-[320px]" />

      <!-- Caption -->
      <p class="mt-3 text-center font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
        x-axis locked to {{ symbol }} · hover a line to see per-scenario gross in native currency
      </p>

      <!-- Crossover list -->
      <div v-if="crossoverList.length" class="mt-3 text-xs">
        <h3 class="mb-1 text-center font-medium text-neutral-600 dark:text-neutral-300">
          Crossovers
        </h3>
        <ul class="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="(c, i) in crossoverList"
            :key="i"
            class="rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-center text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <span class="font-medium">{{ c.pair }}</span> meet at gross
            <span class="tabular-nums font-mono">{{ c.at }}</span>
            (spendable <span class="tabular-nums font-mono">{{ c.spend }}</span
            >)
          </li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Dual-range slider: two <input type="range"> share one track. The inputs are
 * made invisible so the divs above show the track/fill, but their native
 * thumbs remain visible and draggable. pointer-events on the inputs is none
 * (so neither eats clicks over the other's thumb); pointer-events is
 * re-enabled only on the thumbs themselves. */
.dual-range input[type='range'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  pointer-events: none;
}
.dual-range input[type='range']:focus {
  outline: none;
}
.dual-range input[type='range']::-webkit-slider-runnable-track {
  background: transparent;
  height: 100%;
  border: none;
}
.dual-range input[type='range']::-moz-range-track {
  background: transparent;
  height: 100%;
  border: none;
}
.dual-range input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  pointer-events: auto;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: theme('colors.white');
  border: 2px solid theme('colors.blue.600');
  cursor: grab;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.dual-range input[type='range']::-webkit-slider-thumb:active {
  cursor: grabbing;
}
.dual-range input[type='range']::-moz-range-thumb {
  pointer-events: auto;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: theme('colors.white');
  border: 2px solid theme('colors.blue.600');
  cursor: grab;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
:global(.dark) .dual-range input[type='range']::-webkit-slider-thumb {
  background: theme('colors.neutral.950');
}
:global(.dark) .dual-range input[type='range']::-moz-range-thumb {
  background: theme('colors.neutral.950');
}
</style>
