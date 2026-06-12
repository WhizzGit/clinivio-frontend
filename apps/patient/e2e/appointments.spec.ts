import { test, expect, Page } from '@playwright/test';

const SLUG = process.env.TEST_TENANT_SLUG ?? 'demo-hospital';
const TEST_PHONE = process.env.E2E_PATIENT_PHONE ?? '';
const TEST_PASSWORD = process.env.E2E_PATIENT_PASSWORD ?? '';

// ── Shared helper — logs in and returns to the page under test ────────────────

async function loginAs(page: Page, phone: string, password: string) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());

  // Fill slug if there's an input for it
  const slugInput = page.locator('input[name="slug"], select[name="slug"]');
  if (await slugInput.count()) {
    await slugInput.fill(SLUG);
  }

  await page.getByLabel(/phone/i).fill(phone);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /login|sign in/i }).click();

  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
}

// Skip the whole suite if real E2E credentials are not configured.
// Set E2E_PATIENT_PHONE and E2E_PATIENT_PASSWORD as repo secrets / local .env.
const describeWithCreds = TEST_PHONE && TEST_PASSWORD ? test.describe : test.describe.skip;

describeWithCreds('Patient Portal — Appointments (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_PHONE, TEST_PASSWORD);
  });

  test('appointments page loads and shows heading', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: /appointment/i })).toBeVisible();
  });

  test('shows "Book Appointment" button', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page.getByRole('button', { name: /book/i })).toBeVisible();
  });

  test('opens booking panel on button click', async ({ page }) => {
    await page.goto('/appointments');
    await page.getByRole('button', { name: /book/i }).click();
    // The booking form / panel should appear
    await expect(page.getByRole('heading', { name: /book an appointment/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel(/doctor/i)).toBeVisible();
  });

  test('closes booking panel on Cancel', async ({ page }) => {
    await page.goto('/appointments');
    await page.getByRole('button', { name: /book/i }).click();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('heading', { name: /book an appointment/i })).not.toBeVisible();
  });

  test('shows empty state when no appointments exist', async ({ page }) => {
    await page.goto('/appointments');
    // Either a list of appointments or an empty-state message should be visible
    const hasAppointments = await page.locator('[data-testid="appointment-card"]').count();
    if (hasAppointments === 0) {
      await expect(page.getByText(/no appointments/i)).toBeVisible({ timeout: 5000 });
    }
  });
});

// ── UI-only tests (no auth required) ─────────────────────────────────────────

test.describe('Patient Portal — Dashboard UI', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
