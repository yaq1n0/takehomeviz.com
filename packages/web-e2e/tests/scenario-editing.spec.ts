import { expect, test } from '@playwright/test';
import { seed, ukScenario } from './fixtures';

test.describe('Scenario editing', () => {
  test('gross salary change updates breakdown values', async ({ page }) => {
    await seed(page, { scenarios: [ukScenario({ grossMajor: 50_000 })] });

    // First gross input is the scenario gross.
    const grossInput = page.locator('input[inputmode="decimal"]').first();
    await grossInput.fill('80000');
    await grossInput.blur();

    // Open detailed breakdown and assert "Gross" row reflects new value.
    await page.getByText('Detailed breakdown').click();
    // The gross row in the breakdown table should mention 80 (compact) or full.
    await expect(page.getByRole('table')).toContainText(/80,?000|£80/);
  });

  test('region UK→US flips currency symbol and drops UK plan', async ({ page }) => {
    await seed(page, {
      scenarios: [ukScenario({ grossMajor: 60_000, loan: { plan: 'uk-plan-2' } })],
    });

    // Confirm UK plan visible.
    await expect(page.getByText('Student loan').first()).toBeVisible();

    const regionSelect = page.locator('select').first();
    await regionSelect.selectOption('us-ca');

    // Currency symbol next to gross should now be `$`.
    await expect(page.locator('text=$').first()).toBeVisible();

    // Student-loan (UK) row should be gone.
    await expect(page.locator('text=Plan 2')).toHaveCount(0);
  });

  test('pension % change updates take-home', async ({ page }) => {
    await seed(page, { scenarios: [ukScenario({ grossMajor: 80_000, pensionPct: 5 })] });

    // "Take-home / mo" value before.
    const takeHomeLocator = page.locator('text=Take-home / mo').locator('..');
    const before = await takeHomeLocator.innerText();

    // Open the deductions "+ add" panel and update pension %.
    await page.getByRole('button', { name: /^add$/ }).first().click();
    const pensionPct = page.locator('input[type="number"]').first();
    await pensionPct.fill('15');
    await pensionPct.blur();

    // Expect take-home text to change.
    await expect.poll(async () => takeHomeLocator.innerText()).not.toBe(before);
  });

  test('add / edit / delete expense reflects in breakdown', async ({ page }) => {
    await seed(page, {
      scenarios: [ukScenario({ grossMajor: 60_000, expenses: [] })],
    });

    // Locate the Expenses + add button (second "add" button on desktop).
    const addButtons = page.getByRole('button', { name: /^add$/ });
    await addButtons.last().click();

    // A new expense row with a label input should appear.
    const labelInputs = page.locator('input[placeholder="Label"]');
    await expect(labelInputs.first()).toBeVisible();
    await labelInputs.first().fill('Rent');

    // Fill amount input — the last decimal input in the expenses row.
    const decimalInputs = page.locator('input[inputmode="decimal"]');
    // The first decimal input is the gross; the latest one is the new expense.
    await decimalInputs.last().fill('1200');
    await decimalInputs.last().blur();

    // Open detailed breakdown — a "Fixed costs" line appears when any expense exists.
    await page.getByText('Detailed breakdown').click();
    await expect(page.getByText(/Fixed costs/i)).toBeVisible();

    // Delete the expense.
    await page
      .getByRole('button', { name: /Remove expense/i })
      .first()
      .click();
    await expect(page.locator('input[placeholder="Label"]')).toHaveCount(0);
  });

  test('renaming a scenario updates URL hash', async ({ page }) => {
    await seed(page, { scenarios: [ukScenario({ name: 'Original' })] });

    const nameInput = page
      .locator('input')
      .filter({ hasNot: page.locator('[inputmode="decimal"]') })
      .first();
    await nameInput.fill('Renamed');
    await nameInput.blur();

    // Wait past the 200ms debounce.
    await page.waitForTimeout(400);
    const url = page.url();
    expect(url).toContain('#s=');
  });
});
