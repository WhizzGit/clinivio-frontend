import { test, expect } from '@playwright/test';

const SLUG = process.env.TEST_TENANT_SLUG ?? 'demo-hospital';

test.describe('Patient Portal — Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stored auth state before each test
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  // ── Login page ──────────────────────────────────────────────────────────────

  test('shows login form with all required fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in|log in|welcome/i })).toBeVisible();
    await expect(page.getByLabel(/phone/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
  });

  test('shows validation errors on empty submission', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    // At least one validation error should appear
    const errors = page.locator('[class*="error"], [class*="destructive"], [role="alert"]');
    await expect(errors.first()).toBeVisible({ timeout: 3000 });
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/phone/i).fill('9000000000');
    await page.getByLabel(/password/i).fill('WrongPassword1');
    await page.locator('select[name="slug"], input[name="slug"]').fill(SLUG).catch(() => {});
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await expect(page.getByText(/invalid|incorrect|not found/i)).toBeVisible({ timeout: 5000 });
  });

  // ── Registration page ───────────────────────────────────────────────────────

  test('shows register form with required fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/phone/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('shows validation errors on short password', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/first name/i).fill('Test');
    await page.getByLabel(/phone/i).fill('9000000001');
    await page.getByLabel(/password/i).fill('123'); // too short
    await page.getByRole('button', { name: /register|sign up/i }).click();
    const errors = page.locator('[class*="error"], [class*="destructive"], [role="alert"]');
    await expect(errors.first()).toBeVisible({ timeout: 3000 });
  });

  // ── Route protection ────────────────────────────────────────────────────────

  test('redirects unauthenticated user from /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('redirects unauthenticated user from /appointments to /login', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
