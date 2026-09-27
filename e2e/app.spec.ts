import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
test('planner renders, finds a scheduled journey, and exposes route details', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A better way to get there.' })).toBeVisible();
  if (['chromium', 'mobile'].includes(testInfo.project.name)) {
    mkdirSync('docs/screenshots', { recursive: true });
    await page.screenshot({
      path: `docs/screenshots/${testInfo.project.name === 'chromium' ? 'desktop' : 'mobile'}.png`,
      fullPage: true,
    });
  }
  await page.getByLabel('Starting stop', { exact: true }).selectOption('saddar');
  await page.getByLabel('Destination stop').selectOption('secretariat');
  await page.getByLabel('Departure time').fill('08:00');
  await page.getByRole('button', { name: 'Find my route' }).click();
  await expect(page.getByText('EARLIEST ARRIVAL', { exact: true })).toBeVisible();
  await expect(page.getByText('08:56', { exact: true }).first()).toBeVisible();
  await page.goto('/routes');
  await page.getByRole('button', { name: /M1 On schedule/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.stop-timeline li')).toHaveCount(8);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
});
test('register, save a journey, reload and remove it', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await page.getByLabel('Your name').fill('Test Passenger');
  await page
    .getByLabel('Email address')
    .fill(`rider-${testInfo.project.name}-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('a-secure-test-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Starting stop', { exact: true }).selectOption('saddar');
  await page.getByLabel('Destination stop').selectOption('secretariat');
  await page.getByLabel('Departure time').fill('08:00');
  await page.getByRole('button', { name: 'Find my route' }).click();
  await page.getByRole('button', { name: 'Save journey', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Journey saved');
  await page.goto('/saved');
  await expect(page.getByRole('heading', { name: 'Saddar → Pak Secretariat' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Saddar → Pak Secretariat' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText('A fresh start.')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
test('search filters routes and a closed timetable gives a useful empty state', async ({
  page,
}) => {
  await page.goto('/routes');
  await page.getByLabel('Search routes').fill('airport');
  await expect(page.locator('.route-card')).toHaveCount(2);
  await page.getByLabel('Search routes').fill('nonexistent');
  await expect(page.getByText('No matching routes.')).toBeVisible();
  await page.goto('/');
  await page.getByLabel('Starting stop', { exact: true }).selectOption('saddar');
  await page.getByLabel('Destination stop').selectOption('secretariat');
  await page.getByLabel('Departure time').fill('23:59');
  await page.getByRole('button', { name: 'Find my route' }).click();
  await expect(page.getByText('No journeys at this time.')).toBeVisible();
});
test('operator can update fares and see an audit event', async ({ page }) => {
  await page.goto('/operations');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Email address').fill('operator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('operator-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Edit B3', exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'Edit B3', exact: true }).click();
  await page.getByLabel('Fare (PKR)').fill('65');
  await page.getByRole('button', { name: 'Save route', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Rs 65', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Activity log' }).click();
  await expect(
    page.getByRole('cell', { name: 'route.updated campus-blue', exact: true }).first(),
  ).toBeVisible();
});
test('network failures offer retry and never fabricate data', async ({ page }) => {
  await page.route('**/api/network', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'The network is temporarily unavailable.' }),
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable', {
    timeout: 15000,
  });
  await page.unroute('**/api/network');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'A better way to get there.' })).toBeVisible();
});
test('planner meets automated WCAG AA checks and has no horizontal overflow', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A better way to get there.' })).toBeVisible();
  if (isMobile) {
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await page.getByRole('button', { name: 'Close menu', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  }
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
});
