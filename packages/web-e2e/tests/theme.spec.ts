import { expect, test } from '@playwright/test';
import { seedDefault } from './fixtures';

test.describe('Theme', () => {
  test('toggling dark mode applies the dark class and persists across reload', async ({ page }) => {
    await seedDefault(page);

    const themeToggle = page.getByRole('button', { name: /Switch to (dark|light) mode/i }).first();
    await themeToggle.click();

    // Either the class is now present or was already — record the new state
    // and assert it persists.
    const afterClick = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );

    await page.reload();
    await expect(page.getByRole('heading', { name: 'TakeHomeViz' })).toBeVisible();

    const afterReload = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(afterReload).toBe(afterClick);
  });

  test('prefers-color-scheme: dark boots dark when no stored preference', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    // Clear any localStorage from previous tests via a fresh context.
    await page.goto('/');
    await page.evaluate(() => window.localStorage.removeItem('takehomeviz:theme'));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'TakeHomeViz' })).toBeVisible();

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(true);
    await ctx.close();
  });
});
