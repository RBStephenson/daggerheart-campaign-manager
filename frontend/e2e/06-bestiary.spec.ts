import { expect, test } from '@playwright/test';

// Smoke test for DHCM-56 (bestiary browser + spawn-to-Library): a GM browses
// the SRD adversary/environment reference data, searches for one, and spawns
// it into their world's Library — confirming it actually landed there via
// the real Library tab, not just a success message.
test('GM browses the bestiary and adds an adversary to the Library', async ({ page, request }) => {
  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.put('/api/settings', {
    data: { combat_tools_enabled: true, library_enabled: true },
  });

  await page.goto('/login');
  await page.getByLabel('Username').fill('e2e-gm');
  await page.getByLabel('Password').fill('e2e-only-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/gm$/);

  // Create the Library world first — spawning needs one to target. Fresh
  // stack, no other spec touches the Library, so no world exists yet.
  await page.getByRole('link', { name: 'Library' }).click();
  await page.getByPlaceholder('World name').fill('E2E Bestiary World');
  await page.getByRole('button', { name: 'Create world' }).click();
  await expect(page.getByRole('button', { name: 'Continents' })).toBeVisible();

  await page.getByRole('link', { name: 'Bestiary' }).click();
  await expect(page.getByRole('button', { name: /^Adversaries \(\d+\)$/ })).toBeVisible();

  await page.getByPlaceholder('Search by name').fill('Acid Burrower');
  const card = page.getByText('ACID BURROWER');
  await expect(card).toBeVisible();

  await card.click();
  await expect(page.getByText(/horse-sized insect/)).toBeVisible();
  await expect(page.getByText(/Relentless/)).toBeVisible();

  await page.getByRole('button', { name: 'Add to Library' }).click();
  await expect(page.getByRole('button', { name: 'Added to Library' })).toBeVisible();

  // Confirm it actually landed in the Library, not just a local UI flag.
  await page.getByRole('link', { name: 'Library' }).click();
  await page.getByRole('button', { name: /^Adversaries$/ }).click();
  await expect(page.getByText('ACID BURROWER')).toBeVisible();
});

// DHCM-75: same spawn-to-Library flow, for an Environment stat block.
test('GM browses the bestiary and adds an environment to the Library', async ({ page, request }) => {
  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.put('/api/settings', {
    data: { combat_tools_enabled: true, library_enabled: true },
  });

  await page.goto('/login');
  await page.getByLabel('Username').fill('e2e-gm');
  await page.getByLabel('Password').fill('e2e-only-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/gm$/);

  // The world already exists from the adversary-spawn test above — specs
  // share one persistent DB for the run, no need to create it again.
  await page.getByRole('link', { name: 'Bestiary' }).click();
  await page.getByRole('button', { name: /^Environments \(\d+\)$/ }).click();

  await page.getByPlaceholder('Search by name').fill('Abandoned Grove');
  const card = page.getByText('ABANDONED GROVE');
  await expect(card).toBeVisible();

  await card.click();
  await expect(page.getByText(/former druidic grove/)).toBeVisible();

  await page.getByRole('button', { name: 'Add to Library' }).click();
  await expect(page.getByRole('button', { name: 'Added to Library' })).toBeVisible();

  // Confirm it actually landed in the Library, not just a local UI flag.
  await page.getByRole('link', { name: 'Library' }).click();
  await page.getByRole('button', { name: /^Environments$/ }).click();
  await expect(page.getByText('ABANDONED GROVE')).toBeVisible();
});
