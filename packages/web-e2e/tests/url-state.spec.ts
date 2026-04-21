import { expect, test } from '@playwright/test';
import { buildHash, buildLegacyHash, seed, seedDefault, ukScenario } from './fixtures';

test.describe('URL state persistence', () => {
  test('edits persist across reload', async ({ page }) => {
    await seed(page, {
      scenarios: [ukScenario({ name: 'BeforeReload', grossMajor: 55_000 })],
    });

    // Rename via the scenario name input (first text input that isn't decimal).
    const nameInput = page.locator('input').filter({ hasNotText: '' }).first();
    await nameInput.fill('AfterReload');
    await nameInput.blur();
    await page.waitForTimeout(400);

    const urlBefore = page.url();
    expect(urlBefore).toContain('#s=');

    await page.reload();

    // Reloaded state restored from hash.
    await expect(page.locator('input').first()).toHaveValue(/AfterReload|After/);
  });

  test('share URL opens identical state in a fresh context', async ({ browser }) => {
    const hash = buildHash({ scenarios: [ukScenario({ name: 'Shared', grossMajor: 77_000 })] });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/' + hash);

    // Scenario name input shows "Shared".
    await expect(page.locator('input[value="Shared"]').first()).toBeVisible();
    await ctx.close();
  });

  test('corrupt hash shows load-error banner which Dismiss clears', async ({ page }) => {
    await page.goto('/#s=garbage-not-lz-string');
    const banner = page.getByRole('alert');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/Share link|corrupt|invalid|Falling back/i);

    await banner.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // Example scenarios rendered as fallback.
    await expect(page.getByText(/London|Manchester|San Francisco/).first()).toBeVisible();
  });

  test('legacy fixedCostsMonthlyMajor migrates to a Fixed costs expense row', async ({ page }) => {
    const legacyPayload = {
      s: [
        {
          regionId: 'uk-eng',
          year: 2026,
          grossMajor: 60_000,
          currency: 'GBP',
          name: 'Legacy',
          fixedCostsMonthlyMajor: 500,
        },
      ],
    };
    const hash = buildLegacyHash(legacyPayload);
    await page.goto('/' + hash);

    // The migrated expense row label is "Fixed costs".
    await expect(page.locator('input[value="Fixed costs"]').first()).toBeVisible();
  });

  test('empty hash renders example scenarios (not an error)', async ({ page }) => {
    await seedDefault(page);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
