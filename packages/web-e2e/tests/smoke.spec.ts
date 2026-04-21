import { expect, test } from '@playwright/test';
import { collectConsoleErrors, seedDefault } from './fixtures';

test.describe('Smoke', () => {
  test('loads with header, chart canvas, and no console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await seedDefault(page);

    // Header title visible.
    await expect(page.getByRole('heading', { name: 'TakeHomeViz' })).toBeVisible();

    // Chart section heading rendered.
    await expect(
      page.getByRole('heading', { name: /Spending power across gross range/i }),
    ).toBeVisible();

    // uPlot renders a <canvas> inside the chart container.
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeAttached();

    // Give async rendering a moment to settle then assert no console errors.
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('keyboard tab order reaches interactive controls', async ({ page }) => {
    await seedDefault(page);
    // Tab a few times and ensure focus lands on an interactive element each
    // time — we don't assert specific order (too brittle), just that focus is
    // reachable into the body of the app.
    const reachable: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() =>
        document.activeElement ? document.activeElement.tagName.toLowerCase() : '',
      );
      reachable.push(tag);
    }
    // At least one of the focused tags should be an interactive control.
    expect(reachable.some((t) => ['button', 'input', 'select', 'a', 'textarea'].includes(t))).toBe(
      true,
    );
  });
});
