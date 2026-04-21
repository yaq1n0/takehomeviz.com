import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
  calculate,
  sweep,
  Money,
  year,
  listRegions,
  SUPPORTED_YEARS,
  type Breakdown,
  type Currency,
  type RegionId,
  type Scenario,
  type StudentLoanPlanId,
} from '@takehomeviz/engine';
import { moneyFromMajor, moneyToDisplay, type FxConfig } from '../lib/format';
import { decodeUrlState, encodeUrlState, type ChartRange } from '../lib/urlState';
import { exampleScenarios, exampleFx, exampleDisplayCurrency } from '../lib/examples';
import { newExpense, type Expense, type Location, type SerializedScenario } from '../schemas';

const SWEEP_MAX_POINTS = 250;

function regionCurrency(regionId: RegionId): Currency {
  const r = listRegions().find((x) => x.id === regionId);
  return r?.currency ?? 'GBP';
}

function expensesTotalMajor(s: SerializedScenario): number {
  if (!s.expenses || s.expenses.length === 0) return 0;
  return s.expenses.reduce(
    (acc, e) => acc + (Number.isFinite(e.monthlyMajor) ? e.monthlyMajor : 0),
    0,
  );
}

function toScenario(s: SerializedScenario): Scenario {
  const gross = moneyFromMajor(s.grossMajor, s.currency);
  const totalFixed = expensesTotalMajor(s);
  const base: Scenario = {
    regionId: s.regionId,
    year: year(s.year),
    grossAnnual: gross,
    ...(s.pensionPct !== undefined ? { pensionPct: s.pensionPct } : {}),
    ...(s.loan !== undefined ? { studentLoan: { plan: s.loan.plan } } : {}),
    ...(totalFixed > 0 ? { fixedCostsMonthly: moneyFromMajor(totalFixed, s.currency) } : {}),
  };
  return base;
}

function niceStep(max: number): number {
  const target = max / 200;
  if (target <= 0) return 100;
  const exp = Math.floor(Math.log10(target));
  const base = Math.pow(10, exp);
  const norm = target / base;
  let mult: number;
  if (norm < 1.5) mult = 1;
  else if (norm < 3.5) mult = 2;
  else if (norm < 7.5) mult = 5;
  else mult = 10;
  return mult * base;
}

export const useScenariosStore = defineStore('scenarios', () => {
  const scenarios = ref<SerializedScenario[]>([]);
  const fx = ref<number>(exampleFx);
  const displayCurrency = ref<Currency>(exampleDisplayCurrency);
  const chartRange = ref<ChartRange | null>(null);
  const activeScenarioIndex = ref<number>(0);
  const loadError = ref<string | null>(null);

  function loadFromHash(): void {
    const decoded = decodeUrlState(window.location.hash);
    if (decoded && decoded.ok) {
      scenarios.value = decoded.state.scenarios;
      if (decoded.state.fx !== undefined) fx.value = decoded.state.fx;
      if (decoded.state.displayCurrency !== undefined)
        displayCurrency.value = decoded.state.displayCurrency;
      chartRange.value = decoded.state.chartRange ?? null;
      loadError.value = null;
    } else {
      scenarios.value = exampleScenarios.map((s) => ({
        ...s,
        expenses: s.expenses ? s.expenses.map((e) => ({ ...e })) : undefined,
      }));
      fx.value = exampleFx;
      displayCurrency.value = exampleDisplayCurrency;
      chartRange.value = null;
      loadError.value = decoded && !decoded.ok ? decoded.error : null;
    }
    if (activeScenarioIndex.value >= scenarios.value.length) {
      activeScenarioIndex.value = Math.max(0, scenarios.value.length - 1);
    }
  }

  function dismissLoadError(): void {
    loadError.value = null;
  }

  function addScenario(): void {
    const regions = listRegions();
    const fallbackRegion = regions[0];
    if (!fallbackRegion) return;
    const last = scenarios.value[scenarios.value.length - 1];
    const regionId = last?.regionId ?? fallbackRegion.id;
    const currency = regionCurrency(regionId);
    const years = SUPPORTED_YEARS[regionId];
    const y = years[0] ?? 2026;
    scenarios.value.push({
      regionId,
      year: y,
      grossMajor: 100_000,
      currency,
      pensionPct: 5,
      expenses: [newExpense('Rent', 0)],
    });
  }

  function duplicateScenario(index: number): void {
    const source = scenarios.value[index];
    if (!source) return;
    const copy: SerializedScenario = {
      ...source,
      ...(source.loan ? { loan: { ...source.loan } } : {}),
      ...(source.location ? { location: { ...source.location } } : {}),
      ...(source.expenses ? { expenses: source.expenses.map((e) => ({ ...e })) } : {}),
    };
    scenarios.value.splice(index + 1, 0, copy);
    activeScenarioIndex.value = index + 1;
  }

  function removeScenario(index: number): void {
    if (scenarios.value.length <= 1) return;
    scenarios.value.splice(index, 1);
    if (activeScenarioIndex.value >= scenarios.value.length) {
      activeScenarioIndex.value = Math.max(0, scenarios.value.length - 1);
    }
  }

  function updateScenario(index: number, patch: Partial<SerializedScenario>): void {
    const existing = scenarios.value[index];
    if (!existing) return;
    const next: SerializedScenario = { ...existing, ...patch };
    if (patch.regionId && patch.regionId !== existing.regionId) {
      next.currency = regionCurrency(patch.regionId);
      const years = SUPPORTED_YEARS[patch.regionId];
      if (!years.includes(next.year)) {
        next.year = years[0] ?? next.year;
      }
      if (next.loan) {
        const isUkPlan = next.loan.plan.startsWith('uk-');
        const isUkRegion = patch.regionId.startsWith('uk-');
        if (isUkPlan !== isUkRegion) delete next.loan;
      }
    }
    scenarios.value[index] = next;
  }

  function setScenarioName(index: number, name: string): void {
    const existing = scenarios.value[index];
    if (!existing) return;
    const trimmed = name.trim();
    if (trimmed === '') {
      const { name: _omit, ...rest } = existing;
      void _omit;
      scenarios.value[index] = rest;
    } else {
      scenarios.value[index] = { ...existing, name: trimmed };
    }
  }

  function setScenarioLocation(index: number, location: Location | null): void {
    const existing = scenarios.value[index];
    if (!existing) return;
    if (location === null) {
      const { location: _omit, ...rest } = existing;
      void _omit;
      scenarios.value[index] = rest;
    } else {
      scenarios.value[index] = { ...existing, location };
    }
  }

  function setPlan(index: number, plan: StudentLoanPlanId | null): void {
    const existing = scenarios.value[index];
    if (!existing) return;
    if (plan === null) {
      const { loan: _loan, ...rest } = existing;
      void _loan;
      scenarios.value[index] = rest;
    } else {
      scenarios.value[index] = { ...existing, loan: { plan } };
    }
  }

  function addExpense(index: number): void {
    const existing = scenarios.value[index];
    if (!existing) return;
    const nextExpenses = [...(existing.expenses ?? []), newExpense('', 0)];
    scenarios.value[index] = { ...existing, expenses: nextExpenses };
  }

  function updateExpense(
    index: number,
    expenseId: string,
    patch: Partial<Omit<Expense, 'id'>>,
  ): void {
    const existing = scenarios.value[index];
    if (!existing || !existing.expenses) return;
    const nextExpenses = existing.expenses.map((e) =>
      e.id === expenseId ? { ...e, ...patch } : e,
    );
    scenarios.value[index] = { ...existing, expenses: nextExpenses };
  }

  function removeExpense(index: number, expenseId: string): void {
    const existing = scenarios.value[index];
    if (!existing || !existing.expenses) return;
    const nextExpenses = existing.expenses.filter((e) => e.id !== expenseId);
    const next: SerializedScenario = { ...existing };
    if (nextExpenses.length === 0) delete next.expenses;
    else next.expenses = nextExpenses;
    scenarios.value[index] = next;
  }

  function setFx(rate: number): void {
    if (rate > 0 && Number.isFinite(rate)) fx.value = rate;
  }

  function setDisplayCurrency(c: Currency): void {
    displayCurrency.value = c;
  }

  function setChartRange(range: ChartRange | null): void {
    chartRange.value = range;
  }

  function setActiveScenarioIndex(i: number): void {
    if (i >= 0 && i < scenarios.value.length) activeScenarioIndex.value = i;
  }

  const fxConfig = computed<FxConfig>(() => ({
    gbpPerUsd: fx.value,
    displayCurrency: displayCurrency.value,
  }));

  const engineScenarios = computed<Scenario[]>(() => scenarios.value.map(toScenario));

  const breakdowns = computed<Breakdown[]>(() => engineScenarios.value.map(calculate));

  const sweepSeries = computed(() => {
    const sc = scenarios.value;
    if (sc.length === 0) return { xs: [], series: [] as Array<Array<number | null>> };
    const fxCfg = fxConfig.value;
    const cr = chartRange.value;
    let minDisplay: number;
    let maxDisplay: number;
    if (cr) {
      minDisplay = Math.max(0, cr.minMajor);
      maxDisplay = Math.max(minDisplay + 1, cr.maxMajor);
    } else {
      let lo = Infinity;
      let hi = 0;
      for (const s of sc) {
        const money = moneyFromMajor(s.grossMajor, s.currency);
        const d = moneyToDisplay(money, fxCfg);
        if (d < lo) lo = d;
        if (d > hi) hi = d;
      }
      if (!Number.isFinite(lo) || hi <= 0) {
        lo = 0;
        hi = 100_000;
      }
      minDisplay = Math.max(0, lo * 0.9);
      maxDisplay = Math.max(minDisplay + 1, hi * 1.1);
    }
    const span = maxDisplay - minDisplay;
    let step = niceStep(span);
    const pointCount = Math.floor(span / step) + 1;
    if (pointCount > SWEEP_MAX_POINTS) {
      step = span / (SWEEP_MAX_POINTS - 1);
    }
    const xs: number[] = [];
    for (let i = 0; i < SWEEP_MAX_POINTS; i += 1) {
      const x = minDisplay + i * step;
      if (x > maxDisplay) break;
      xs.push(x);
    }
    if (xs.length === 0) xs.push(minDisplay);
    const series: Array<Array<number | null>> = sc.map((s, idx) => {
      const scenario = engineScenarios.value[idx];
      if (!scenario) return xs.map(() => null);
      const currency = s.currency;
      const xsNative: number[] = xs.map((x) => displayToNative(x, currency, fxCfg));
      const base = {
        regionId: scenario.regionId,
        year: scenario.year,
        ...(scenario.pensionPct !== undefined ? { pensionPct: scenario.pensionPct } : {}),
        ...(scenario.studentLoan !== undefined ? { studentLoan: scenario.studentLoan } : {}),
        ...(scenario.fixedCostsMonthly !== undefined
          ? { fixedCostsMonthly: scenario.fixedCostsMonthly }
          : {}),
      };
      const minNative = Math.min(...xsNative);
      const maxNative = Math.max(...xsNative);
      const fromMinor = Math.max(0, Math.round(minNative * 100));
      const from = new Money(fromMinor, currency);
      const toMinor = Math.max(fromMinor + 1, Math.round(maxNative * 100));
      const to = new Money(toMinor, currency);
      const stepMinor = Math.max(1, Math.round(((maxNative - minNative) / (xs.length - 1)) * 100));
      const stepMoney = new Money(stepMinor, currency);
      const breakdownList = sweep(base, { from, to, step: stepMoney });
      const nativeGrosses = breakdownList.map((b) => b.gross.amount / 100);
      return xsNative.map((xn) => {
        let lo = 0;
        let hi = nativeGrosses.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          const midVal = nativeGrosses[mid] ?? 0;
          if (midVal < xn) lo = mid + 1;
          else hi = mid;
        }
        const hit = breakdownList[lo];
        if (!hit) return null;
        return moneyToDisplay(hit.spendable, fxCfg);
      });
    });
    return { xs, series };
  });

  // Persist state to the URL hash whenever it changes. Debounced so typing
  // into a number field doesn't spam history.replaceState.
  let timer: number | null = null;
  watch(
    [scenarios, fx, displayCurrency, chartRange],
    () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const hash = encodeUrlState({
          scenarios: scenarios.value,
          fx: fx.value,
          displayCurrency: displayCurrency.value,
          chartRange: chartRange.value ?? undefined,
        });
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}${hash}`,
        );
      }, 200);
    },
    { deep: true },
  );

  return {
    scenarios,
    fx,
    displayCurrency,
    chartRange,
    activeScenarioIndex,
    loadError,
    fxConfig,
    engineScenarios,
    breakdowns,
    sweepSeries,
    loadFromHash,
    dismissLoadError,
    addScenario,
    duplicateScenario,
    removeScenario,
    updateScenario,
    setScenarioName,
    setScenarioLocation,
    setPlan,
    addExpense,
    updateExpense,
    removeExpense,
    setFx,
    setDisplayCurrency,
    setChartRange,
    setActiveScenarioIndex,
  };
});

function displayToNative(displayAmount: number, native: Currency, fx: FxConfig): number {
  if (native === fx.displayCurrency) return displayAmount;
  if (native === 'USD' && fx.displayCurrency === 'GBP') {
    return displayAmount / fx.gbpPerUsd;
  }
  return displayAmount * fx.gbpPerUsd;
}
