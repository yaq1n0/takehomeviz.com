import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { seedDefault } from './fixtures';

test.describe('Accessibility smoke', () => {
  test('default page has no serious/critical axe violations', async ({ page }) => {
    await seedDefault(page);
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
  });

  test('dark mode page has no serious/critical axe violations', async ({ page }) => {
    await seedDefault(page);
    // Flip to dark via the toggle.
    const toggle = page.getByRole('button', { name: /Switch to (dark|light) mode/i }).first();
    const isDarkBefore = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    if (!isDarkBefore) {
      await toggle.click();
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(true);

    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
  });
});
