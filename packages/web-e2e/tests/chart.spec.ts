import { expect, test } from '@playwright/test';
import { collectConsoleErrors, seed, ukScenario } from './fixtures';

test.describe('Chart behaviour', () => {
  test('custom chart range via URL applies on load; reset button brings back auto', async ({
    page,
  }) => {
    await seed(page, {
      scenarios: [ukScenario({ grossMajor: 60_000 })],
      chartRange: { minMajor: 20_000, maxMajor: 200_000 },
    });

    // The reset button is enabled (not auto) when a custom range is active.
    const resetBtn = page.getByRole('button', { name: /Reset chart range/i });
    await expect(resetBtn).toBeEnabled();

    await resetBtn.click();
    await expect(resetBtn).toBeDisabled();
  });

  test('hovering the chart does not throw', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await seed(page, { scenarios: [ukScenario({ grossMajor: 60_000 })] });

    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.4);
    }
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
  });

  test('zero-gross scenario does not crash the chart', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await seed(page, {
      scenarios: [ukScenario({ grossMajor: 0, pensionPct: 0, name: 'Zero' })],
    });

    await expect(page.locator('canvas').first()).toBeAttached();
    await page.waitForTimeout(400);
    expect(errors).toEqual([]);
  });
});
