import { expect, test } from '@playwright/test';
import { seed, ukScenario } from './fixtures';

test.describe('Student loan plans', () => {
  test('enabling uk-plan-2 adds a student loan deduction', async ({ page }) => {
    await seed(page, { scenarios: [ukScenario({ grossMajor: 80_000 })] });

    // Open the "+ add" deductions panel and tick student-loan.
    await page.getByRole('button', { name: /^add$/ }).first().click();
    const loanCheckbox = page.getByRole('checkbox').nth(1);
    await loanCheckbox.check();

    // Student loan badge appears.
    await expect(page.getByText(/Student loan/i).first()).toBeVisible();

    // Detailed breakdown table has a row mentioning "student" (loan).
    await page.getByText('Detailed breakdown').click();
    await expect(page.getByRole('table')).toContainText(/student/i);
  });

  test('disabling plan removes deduction row', async ({ page }) => {
    await seed(page, {
      scenarios: [ukScenario({ grossMajor: 80_000, loan: { plan: 'uk-plan-2' } })],
    });

    await page.getByRole('button', { name: /^add$/ }).first().click();
    const loanCheckbox = page.getByRole('checkbox').nth(1);
    await loanCheckbox.uncheck();

    // Badge row disappears.
    await expect(page.locator('text=Plan 2')).toHaveCount(0);
  });

  test('switching region UK→US drops the UK student-loan plan', async ({ page }) => {
    await seed(page, {
      scenarios: [ukScenario({ grossMajor: 80_000, loan: { plan: 'uk-plan-2' } })],
    });

    await expect(page.locator('text=Plan 2')).toBeVisible();

    const regionSelect = page.locator('select').first();
    await regionSelect.selectOption('us-ca');

    await expect(page.locator('text=Plan 2')).toHaveCount(0);
  });
});
