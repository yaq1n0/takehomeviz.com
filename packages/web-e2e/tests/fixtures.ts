import { expect, type Page } from '@playwright/test';
import { compressToEncodedURIComponent } from 'lz-string';

/**
 * A minimal shape mirror of `SerializedScenario` from `@takehomeviz/web`.
 * We duplicate the structural types here so this helper stays self-contained
 * and doesn't require the web package to expose runtime schemas.
 */
export type E2EExpense = {
  id: string;
  label: string;
  monthlyMajor: number;
};

export type E2EScenario = {
  regionId: 'uk-eng' | 'us-ca' | 'us-ny' | 'us-wa' | 'us-tx';
  year: number;
  grossMajor: number;
  currency: 'GBP' | 'USD';
  name?: string;
  pensionPct?: number;
  loan?: { plan: 'uk-plan-1' | 'uk-plan-2' | 'uk-plan-4' | 'uk-plan-5' | 'uk-postgrad' };
  expenses?: E2EExpense[];
};

export type E2EUrlState = {
  s: unknown[];
  fx?: number;
  dc?: 'GBP' | 'USD';
  cr?: { minMajor: number; maxMajor: number };
};

/**
 * Build a share-hash fragment for the given state, exactly like
 * `encodeUrlState` in `@takehomeviz/web/src/lib/urlState.ts`.
 */
export function buildHash(state: {
  scenarios: E2EScenario[];
  fx?: number;
  displayCurrency?: 'GBP' | 'USD';
  chartRange?: { minMajor: number; maxMajor: number };
}): string {
  const payload: E2EUrlState = {
    s: state.scenarios,
    ...(state.fx !== undefined ? { fx: state.fx } : {}),
    ...(state.displayCurrency !== undefined ? { dc: state.displayCurrency } : {}),
    ...(state.chartRange !== undefined ? { cr: state.chartRange } : {}),
  };
  const json = JSON.stringify(payload);
  const compressed = compressToEncodedURIComponent(json);
  return `#s=${compressed}`;
}

/**
 * Build a hash from an arbitrary (possibly-legacy) payload shape. Used by the
 * URL-migration test which needs to inject `fixedCostsMonthlyMajor`.
 */
export function buildLegacyHash(payload: unknown): string {
  const json = JSON.stringify(payload);
  const compressed = compressToEncodedURIComponent(json);
  return `#s=${compressed}`;
}

/**
 * Navigate to the app with a pre-built hash.
 */
export async function seed(
  page: Page,
  state: Parameters<typeof buildHash>[0] | { rawHash: string },
): Promise<void> {
  const hash = 'rawHash' in state ? state.rawHash : buildHash(state);
  await page.goto('/' + hash);
  // Wait for at least one scenario region select to render.
  await expect(page.locator('select').first()).toBeVisible();
}

/**
 * Navigate to `/` and wait for the example scenarios to appear.
 */
export async function seedDefault(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(/London|Manchester|San Francisco/).first()).toBeVisible();
}

/**
 * A standard UK scenario fixture usable across tests.
 */
export function ukScenario(overrides: Partial<E2EScenario> = {}): E2EScenario {
  return {
    regionId: 'uk-eng',
    year: 2026,
    grossMajor: 60_000,
    currency: 'GBP',
    name: 'UK Scenario',
    pensionPct: 5,
    ...overrides,
  };
}

export function usScenario(overrides: Partial<E2EScenario> = {}): E2EScenario {
  return {
    regionId: 'us-ca',
    year: 2026,
    grossMajor: 150_000,
    currency: 'USD',
    name: 'US Scenario',
    pensionPct: 5,
    ...overrides,
  };
}

/**
 * Collect console errors from a page. Returns a live-mutated array — assert
 * `toEqual([])` at end of a test.
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });
  return errors;
}
