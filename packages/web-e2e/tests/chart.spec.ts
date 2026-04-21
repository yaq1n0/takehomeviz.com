import { expect, test } from '@playwright/test';
import { collectConsoleErrors, seed, ukScenario } from './fixtures';
import { testIds } from './testids';

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

  test('fullscreen toggle teleports the card to body and fills the viewport', async ({ page }) => {
    await seed(page, { scenarios: [ukScenario({ grossMajor: 60_000 })] });

    const toggle = page.getByTestId(testIds.chartFullscreenToggle);
    const card = page.getByTestId('chart-card');
    await expect(toggle).toHaveAccessibleName(/Enter fullscreen/i);

    // Before: card is nested in app layout, not a direct child of <body>.
    expect(await card.evaluate((el) => el.parentElement?.tagName.toLowerCase())).not.toBe('body');

    await toggle.click();
    await expect(toggle).toHaveAccessibleName(/Exit fullscreen/i);
    await expect(page.locator('canvas').first()).toBeVisible();

    // After: teleported to <body> and sized to the viewport.
    expect(await card.evaluate((el) => el.parentElement?.tagName.toLowerCase())).toBe('body');
    const viewport = page.viewportSize();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (box && viewport) {
      // Anchored to the top-left corner of the viewport, spanning the whole
      // viewport (allow a 1px rounding tolerance). Without the position
      // assertion a merely viewport-sized element still in normal flow would
      // pass — which is exactly the bug we hit on Firefox.
      expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.y)).toBeLessThanOrEqual(1);
      expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
      expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);
    }

    // Computed position must actually be `fixed` — guards against conflicting
    // utilities (`relative` + `fixed`) where later-emitted CSS wins.
    expect(await card.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');

    // Body scroll is locked while fullscreen.
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    // Escape exits fullscreen, card returns to app layout, body scroll restored.
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAccessibleName(/Enter fullscreen/i);
    expect(await card.evaluate((el) => el.parentElement?.tagName.toLowerCase())).not.toBe('body');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
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
