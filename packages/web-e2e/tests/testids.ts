/**
 * Central registry of `data-testid` values used by e2e tests.
 *
 * Keep this in sync with the `data-testid` attributes in the web package.
 * Prefer Playwright's semantic locators (getByRole/getByText) for user-facing
 * assertions; only add a testid here when a semantic locator is ambiguous or
 * brittle (e.g. duplicated roles, third-party markup like uPlot's legend).
 */
export const testIds = {
  appHeader: 'app-header',
  breakdownTable: 'breakdown-table',
  chartFullscreenToggle: 'chart-fullscreen-toggle',
} as const;

export type TestId = (typeof testIds)[keyof typeof testIds];
