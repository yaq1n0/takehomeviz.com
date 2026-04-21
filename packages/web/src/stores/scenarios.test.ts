import { createPinia, setActivePinia } from 'pinia';
import { vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { useScenariosStore } from './scenarios';
import { encodeUrlState } from '../lib/urlState';
import { exampleScenarios } from '../lib/examples';
import type { SerializedScenario } from '../schemas';

function stubLocation(hash: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { hash, pathname: '/', search: '' },
  });
}

let replaceStateSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  setActivePinia(createPinia());
  stubLocation('');
  replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  replaceStateSpy.mockRestore();
});

describe('loadFromHash', () => {
  it('seeds example scenarios when hash is empty and clears loadError', () => {
    const store = useScenariosStore();
    store.loadError = 'prev';
    store.loadFromHash();
    expect(store.scenarios.length).toBe(exampleScenarios.length);
    expect(store.loadError).toBeNull();
  });

  it('populates store with valid encoded state and clamps activeScenarioIndex', () => {
    const scenarios: SerializedScenario[] = [
      { regionId: 'uk-eng', year: 2026, grossMajor: 50_000, currency: 'GBP' },
    ];
    const hash = encodeUrlState({
      scenarios,
      fx: 0.9,
      displayCurrency: 'USD',
      chartRange: undefined,
    });
    stubLocation(hash);
    const store = useScenariosStore();
    store.activeScenarioIndex = 5;
    store.loadFromHash();
    expect(store.scenarios).toEqual(scenarios);
    expect(store.fx).toBe(0.9);
    expect(store.displayCurrency).toBe('USD');
    expect(store.activeScenarioIndex).toBe(0);
  });

  it('falls back to examples and sets loadError on corrupt hash', () => {
    stubLocation('#s=!!bad!!');
    const store = useScenariosStore();
    store.loadFromHash();
    expect(store.scenarios.length).toBe(exampleScenarios.length);
    expect(store.loadError).toBeTruthy();
  });
});

describe('dismissLoadError', () => {
  it('clears the error', () => {
    const store = useScenariosStore();
    store.loadError = 'oops';
    store.dismissLoadError();
    expect(store.loadError).toBeNull();
  });
});

describe('addScenario', () => {
  it('appends a new scenario using previous regionId and a supported year', () => {
    const store = useScenariosStore();
    store.loadFromHash();
    const before = store.scenarios.length;
    const prevRegion = store.scenarios[before - 1]!.regionId;
    store.addScenario();
    const added = store.scenarios[store.scenarios.length - 1]!;
    expect(store.scenarios.length).toBe(before + 1);
    expect(added.regionId).toBe(prevRegion);
    expect(added.year).toBe(2026);
  });
});

describe('removeScenario', () => {
  it('is a no-op when length <= 1', () => {
    const store = useScenariosStore();
    store.scenarios = [{ regionId: 'uk-eng', year: 2026, grossMajor: 10, currency: 'GBP' }];
    store.removeScenario(0);
    expect(store.scenarios.length).toBe(1);
  });

  it('clamps activeScenarioIndex when removing the last item', () => {
    const store = useScenariosStore();
    store.loadFromHash();
    store.activeScenarioIndex = store.scenarios.length - 1;
    const lastIdx = store.scenarios.length - 1;
    store.removeScenario(lastIdx);
    expect(store.activeScenarioIndex).toBe(store.scenarios.length - 1);
  });
});

describe('updateScenario', () => {
  it('on region change resets currency, snaps year, drops incompatible UK student loan', () => {
    const store = useScenariosStore();
    store.scenarios = [
      {
        regionId: 'uk-eng',
        year: 2026,
        grossMajor: 50_000,
        currency: 'GBP',
        loan: { plan: 'uk-plan-2' },
      },
    ];
    store.updateScenario(0, { regionId: 'us-ca' });
    const s = store.scenarios[0]!;
    expect(s.regionId).toBe('us-ca');
    expect(s.currency).toBe('USD');
    expect(s.year).toBe(2026);
    expect(s.loan).toBeUndefined();
  });

  it('keeps student loan when region stays on the same side (UK→UK)', () => {
    const store = useScenariosStore();
    store.scenarios = [
      {
        regionId: 'uk-eng',
        year: 2026,
        grossMajor: 50_000,
        currency: 'GBP',
        loan: { plan: 'uk-plan-2' },
      },
    ];
    store.updateScenario(0, { grossMajor: 60_000 });
    expect(store.scenarios[0]!.loan?.plan).toBe('uk-plan-2');
  });

  it('is a no-op for invalid index', () => {
    const store = useScenariosStore();
    store.scenarios = [{ regionId: 'uk-eng', year: 2026, grossMajor: 1, currency: 'GBP' }];
    store.updateScenario(99, { grossMajor: 999 });
    expect(store.scenarios[0]!.grossMajor).toBe(1);
  });
});

describe('setScenarioName', () => {
  it('empty / whitespace removes name field', () => {
    const store = useScenariosStore();
    store.scenarios = [
      { regionId: 'uk-eng', year: 2026, grossMajor: 1, currency: 'GBP', name: 'X' },
    ];
    store.setScenarioName(0, '   ');
    expect(store.scenarios[0]!.name).toBeUndefined();
  });

  it('non-empty trims and sets', () => {
    const store = useScenariosStore();
    store.scenarios = [{ regionId: 'uk-eng', year: 2026, grossMajor: 1, currency: 'GBP' }];
    store.setScenarioName(0, '  Hello  ');
    expect(store.scenarios[0]!.name).toBe('Hello');
  });

  it('no-op for invalid index', () => {
    const store = useScenariosStore();
    store.scenarios = [];
    expect(() => store.setScenarioName(0, 'x')).not.toThrow();
  });
});

describe('setScenarioLocation', () => {
  const loc = { countryCode: 'GB', countryName: 'United Kingdom', cityName: 'London' } as const;

  it('sets location when non-null', () => {
    const store = useScenariosStore();
    store.scenarios = [{ regionId: 'uk-eng', year: 2026, grossMajor: 1, currency: 'GBP' }];
    store.setScenarioLocation(0, { ...loc });
    expect(store.scenarios[0]!.location).toEqual(loc);
  });

  it('null removes the location key', () => {
    const store = useScenariosStore();
    store.scenarios = [
      { regionId: 'uk-eng', year: 2026, grossMajor: 1, currency: 'GBP', location: { ...loc } },
    ];
    store.setScenarioLocation(0, null);
    expect(store.scenarios[0]!.location).toBeUndefined();
    expect('location' in store.scenarios[0]!).toBe(false);
  });

  it('round-trips through encode/decode', async () => {
    const store = useScenariosStore();
    store.scenarios = [
      { regionId: 'uk-eng', year: 2026, grossMajor: 1, currency: 'GBP', location: { ...loc } },
    ];
    const { encodeUrlState: enc } = await import('../lib/urlState');
    const { decodeUrlState: dec } = await import('../lib/urlState');
    const hash = enc({
      scenarios: store.scenarios,
      fx: undefined,
      displayCurrency: undefined,
      chartRange: undefined,
    });
    const decoded = dec(hash);
    expect(decoded?.ok).toBe(true);
    if (decoded?.ok) expect(decoded.state.scenarios[0]!.location).toEqual(loc);
  });

  it('no-op for invalid index', () => {
    const store = useScenariosStore();
    store.scenarios = [];
    expect(() => store.setScenarioLocation(0, { ...loc })).not.toThrow();
  });
});

describe('setPlan', () => {
  it('null drops loan', () => {
    const store = useScenariosStore();
    store.scenarios = [
      {
        regionId: 'uk-eng',
        year: 2026,
        grossMajor: 1,
        currency: 'GBP',
        loan: { plan: 'uk-plan-2' },
      },
    ];
    store.setPlan(0, null);
    expect(store.scenarios[0]!.loan).toBeUndefined();
  });

  it('non-null sets loan', () => {
    const store = useScenariosStore();
    store.scenarios = [{ regionId: 'uk-eng', year: 2026, grossMajor: 1, currency: 'GBP' }];
    store.setPlan(0, 'uk-plan-2');
    expect(store.scenarios[0]!.loan?.plan).toBe('uk-plan-2');
  });

  it('no-op for invalid index', () => {
    const store = useScenariosStore();
    expect(() => store.setPlan(5, null)).not.toThrow();
  });
});

describe('expense management', () => {
  it('addExpense appends and preserves existing ids', () => {
    const store = useScenariosStore();
    store.scenarios = [
      {
        regionId: 'uk-eng',
        year: 2026,
        grossMajor: 1,
        currency: 'GBP',
        expenses: [{ id: 'keep', label: 'Rent', monthlyMajor: 100 }],
      },
    ];
    store.addExpense(0);
    const exp = store.scenarios[0]!.expenses!;
    expect(exp).toHaveLength(2);
    expect(exp[0]!.id).toBe('keep');
  });

  it('updateExpense patches matching id', () => {
    const store = useScenariosStore();
    store.scenarios = [
      {
        regionId: 'uk-eng',
        year: 2026,
        grossMajor: 1,
        currency: 'GBP',
        expenses: [{ id: 'a', label: 'x', monthlyMajor: 1 }],
      },
    ];
    store.updateExpense(0, 'a', { monthlyMajor: 250 });
    expect(store.scenarios[0]!.expenses![0]!.monthlyMajor).toBe(250);
    expect(store.scenarios[0]!.expenses![0]!.id).toBe('a');
  });

  it('removeExpense drops expenses key when last one is removed', () => {
    const store = useScenariosStore();
    store.scenarios = [
      {
        regionId: 'uk-eng',
        year: 2026,
        grossMajor: 1,
        currency: 'GBP',
        expenses: [{ id: 'a', label: 'x', monthlyMajor: 1 }],
      },
    ];
    store.removeExpense(0, 'a');
    expect(store.scenarios[0]!.expenses).toBeUndefined();
  });

  it('removeExpense keeps remaining expenses', () => {
    const store = useScenariosStore();
    store.scenarios = [
      {
        regionId: 'uk-eng',
        year: 2026,
        grossMajor: 1,
        currency: 'GBP',
        expenses: [
          { id: 'a', label: 'x', monthlyMajor: 1 },
          { id: 'b', label: 'y', monthlyMajor: 2 },
        ],
      },
    ];
    store.removeExpense(0, 'a');
    expect(store.scenarios[0]!.expenses).toHaveLength(1);
    expect(store.scenarios[0]!.expenses![0]!.id).toBe('b');
  });

  it('invalid indices and missing expenses are no-ops', () => {
    const store = useScenariosStore();
    store.scenarios = [{ regionId: 'uk-eng', year: 2026, grossMajor: 1, currency: 'GBP' }];
    expect(() => store.addExpense(99)).not.toThrow();
    expect(() => store.updateExpense(99, 'x', {})).not.toThrow();
    expect(() => store.updateExpense(0, 'x', {})).not.toThrow();
    expect(() => store.removeExpense(99, 'x')).not.toThrow();
    expect(() => store.removeExpense(0, 'x')).not.toThrow();
  });
});

describe('setFx / setDisplayCurrency / setChartRange / setActiveScenarioIndex', () => {
  it('setFx rejects non-positive and non-finite', () => {
    const store = useScenariosStore();
    const initial = store.fx;
    store.setFx(0);
    store.setFx(-1);
    store.setFx(Infinity);
    store.setFx(NaN);
    expect(store.fx).toBe(initial);
    store.setFx(0.5);
    expect(store.fx).toBe(0.5);
  });

  it('setDisplayCurrency sets the currency', () => {
    const store = useScenariosStore();
    store.setDisplayCurrency('USD');
    expect(store.displayCurrency).toBe('USD');
  });

  it('setChartRange sets and clears', () => {
    const store = useScenariosStore();
    store.setChartRange({ minMajor: 0, maxMajor: 100 });
    expect(store.chartRange).toEqual({ minMajor: 0, maxMajor: 100 });
    store.setChartRange(null);
    expect(store.chartRange).toBeNull();
  });

  it('setActiveScenarioIndex clamps to valid range', () => {
    const store = useScenariosStore();
    store.loadFromHash();
    store.setActiveScenarioIndex(-1);
    expect(store.activeScenarioIndex).toBe(0);
    store.setActiveScenarioIndex(999);
    expect(store.activeScenarioIndex).toBe(0);
    store.setActiveScenarioIndex(1);
    expect(store.activeScenarioIndex).toBe(1);
  });
});

describe('derived: engineScenarios / breakdowns / sweepSeries', () => {
  it('engineScenarios maps to engine Money shape', () => {
    const store = useScenariosStore();
    store.scenarios = [
      {
        regionId: 'uk-eng',
        year: 2026,
        grossMajor: 50_000,
        currency: 'GBP',
        pensionPct: 5,
        loan: { plan: 'uk-plan-2' },
        expenses: [{ id: 'a', label: 'Rent', monthlyMajor: 1_200 }],
      },
    ];
    const [e] = store.engineScenarios;
    expect(e!.regionId).toBe('uk-eng');
    expect(e!.grossAnnual.amount).toBe(5_000_000);
    expect(e!.grossAnnual.currency).toBe('GBP');
    expect(e!.pensionPct).toBe(5);
    expect(e!.studentLoan?.plan).toBe('uk-plan-2');
    expect(e!.fixedCostsMonthly?.amount).toBe(120_000);
  });

  it('breakdowns length matches scenarios and has Money-shaped fields', () => {
    const store = useScenariosStore();
    store.loadFromHash();
    expect(store.breakdowns.length).toBe(store.scenarios.length);
    for (const b of store.breakdowns) {
      expect(b.gross).toBeDefined();
      expect(typeof b.gross.amount).toBe('number');
    }
  });

  it('sweepSeries xs is <=250, non-decreasing; series length matches', () => {
    const store = useScenariosStore();
    store.loadFromHash();
    const { xs, series } = store.sweepSeries;
    expect(xs.length).toBeGreaterThan(0);
    expect(xs.length).toBeLessThanOrEqual(250);
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]!).toBeGreaterThanOrEqual(xs[i - 1]!);
    }
    expect(series.length).toBe(store.scenarios.length);
  });

  it('sweepSeries respects chartRange when set', () => {
    const store = useScenariosStore();
    store.loadFromHash();
    store.setChartRange({ minMajor: 10_000, maxMajor: 50_000 });
    const { xs } = store.sweepSeries;
    expect(xs[0]!).toBeGreaterThanOrEqual(10_000);
    expect(xs[xs.length - 1]!).toBeLessThanOrEqual(50_000);
  });

  it('sweepSeries auto-scales to [0.9x min, 1.1x max] grossMajor when range unset', () => {
    const store = useScenariosStore();
    store.scenarios = [
      { regionId: 'uk-eng', year: 2026, grossMajor: 80_000, currency: 'GBP' },
      { regionId: 'uk-eng', year: 2026, grossMajor: 120_000, currency: 'GBP' },
    ];
    store.setChartRange(null);
    const { xs } = store.sweepSeries;
    expect(xs[0]!).toBeGreaterThanOrEqual(80_000 * 0.9 - 1);
    expect(xs[0]!).toBeLessThan(80_000);
    expect(xs[xs.length - 1]!).toBeLessThanOrEqual(120_000 * 1.1 + 1);
    expect(xs[xs.length - 1]!).toBeGreaterThan(120_000);
  });

  it('sweepSeries handles all-zero gross without crashing', () => {
    const store = useScenariosStore();
    store.scenarios = [{ regionId: 'uk-eng', year: 2026, grossMajor: 0, currency: 'GBP' }];
    const res = store.sweepSeries;
    expect(res.xs.length).toBeGreaterThan(0);
  });

  it('sweepSeries returns empty when no scenarios', () => {
    const store = useScenariosStore();
    store.scenarios = [];
    const { xs, series } = store.sweepSeries;
    expect(xs).toEqual([]);
    expect(series).toEqual([]);
  });
});

describe('URL-write watcher debounce', () => {
  it('debounces multiple mutations into one history.replaceState call', async () => {
    vi.useFakeTimers();
    const store = useScenariosStore();
    store.loadFromHash();
    // Flush the watcher that fired from loadFromHash's mutations.
    await nextTick();
    vi.advanceTimersByTime(300);
    replaceStateSpy.mockClear();

    store.setFx(0.81);
    await nextTick();
    store.setFx(0.82);
    await nextTick();
    store.setFx(0.83);
    await nextTick();

    expect(replaceStateSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
  });
});
