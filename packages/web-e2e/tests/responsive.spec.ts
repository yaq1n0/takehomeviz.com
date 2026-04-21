import { expect, test } from '@playwright/test';
import { seedDefault } from './fixtures';

test.describe('Responsive layout', () => {
  test('desktop viewport shows scenario list, hides mobile tabs', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedDefault(page);

    // Desktop: multiple scenario panes visible (example has 3).
    const panes = page.locator('section[aria-label^="Scenario"]');
    await expect(panes).toHaveCount(3);

    // No tablist at desktop breakpoint.
    await expect(page.getByRole('tablist', { name: /Scenarios/i })).toHaveCount(0);
  });

  test('mobile viewport shows tabs and only the active pane @mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedDefault(page);

    // Tablist visible.
    await expect(page.getByRole('tablist', { name: /Scenarios/i })).toBeVisible();

    // Only one scenario pane in the DOM.
    const panes = page.locator('section[aria-label^="Scenario"]');
    await expect(panes).toHaveCount(1);

    // Tap a different tab and assert the active tab advances.
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    if (count > 1) {
      await tabs.nth(1).click();
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    }
  });
});
