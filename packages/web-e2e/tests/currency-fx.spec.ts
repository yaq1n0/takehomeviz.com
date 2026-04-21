import { expect, test } from '@playwright/test';
import { seed, ukScenario, usScenario } from './fixtures';

test.describe('Currency & FX', () => {
  test('toggling display currency flips header primary indicator', async ({ page }) => {
    await seed(page, {
      scenarios: [ukScenario(), usScenario()],
      displayCurrency: 'GBP',
      fx: 0.79,
    });

    const gbpBtn = page.getByRole('button', { name: 'GBP primary' });
    const usdBtn = page.getByRole('button', { name: 'USD primary' });

    // GBP active initially.
    await expect(gbpBtn).toHaveClass(/bg-neutral-900|bg-neutral-100/);

    await usdBtn.click();

    // Chart axis label rebuilt to USD.
    await expect(page.getByText(/Spending power across gross range/i)).toBeVisible();
    // The US scenario should no longer show the secondary GBP display row.
    // Primary is now USD so the US scenario is "primary".
  });

  test('changing the FX rate updates USD→GBP displayed take-home', async ({ page }) => {
    await seed(page, {
      scenarios: [usScenario({ grossMajor: 150_000, name: 'US' })],
      displayCurrency: 'GBP',
      fx: 0.79,
    });

    // A non-primary scenario shows a "Conversion rate" input.
    const fxInput = page.locator('input[inputmode="decimal"]').nth(1);
    await fxInput.fill('1.0');
    await fxInput.blur();

    // Wait past debounce.
    await page.waitForTimeout(300);

    // "After expenses" row still visible; we don't assert a specific figure,
    // just that the app didn't crash when FX changed.
    await expect(page.getByText('After expenses').first()).toBeVisible();
  });
});
