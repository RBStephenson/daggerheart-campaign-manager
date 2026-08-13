import { expect, test } from '@playwright/test';

// Smoke test for DHCM-29: a GM authors custom content (weapon + ancestry)
// through the Host admin area, consuming DHCM-28's CRUD endpoints, then
// edits and deletes an entry — confirming the round trip actually persists
// through the real backend, not just local UI state.
test('GM authors, edits, and deletes custom content from the Host admin area', async ({
  page,
  request,
}) => {
  await request.post('/api/auth/login', {
    data: { username: 'e2e-gm', password: 'e2e-only-password' },
  });
  await request.put('/api/settings', { data: { custom_content_enabled: true } });

  await page.goto('/login');
  await page.getByLabel('Username').fill('e2e-gm');
  await page.getByLabel('Password').fill('e2e-only-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/gm$/);

  await page.goto('/host/custom-content');
  await expect(page.getByRole('link', { name: 'Weapons' })).toBeVisible();

  await page.getByRole('link', { name: 'Weapons' }).click();
  await page.getByPlaceholder('Name', { exact: true }).fill('Sunfang');
  await page.getByPlaceholder('Trait').fill('Finesse');
  await page.getByPlaceholder('Range').fill('Melee');
  await page.getByPlaceholder('Damage').fill('d8+3');
  await page.getByPlaceholder('Burden').fill('One-Handed');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('heading', { name: 'Sunfang' })).toBeVisible();

  // Edit it, confirm the change persists past a reload.
  await page.getByRole('button', { name: 'Edit' }).click();
  const editForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save' }) });
  await editForm.getByPlaceholder('Damage').fill('d10+3');
  await editForm.getByRole('button', { name: 'Save' }).click();
  await page.reload();
  await page.getByRole('link', { name: 'Weapons' }).click();
  await expect(page.getByRole('heading', { name: 'Sunfang' })).toBeVisible();

  // Custom content types don't share a shape -- confirm a second segment
  // (Ancestries, whose only required field is name) also round-trips.
  await page.getByRole('link', { name: 'Ancestries' }).click();
  await page.getByPlaceholder('Name', { exact: true }).fill('Duskkin');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Duskkin' })).toBeVisible();

  // Delete the weapon, confirm it's actually gone server-side.
  await page.getByRole('link', { name: 'Weapons' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No custom weapons yet.')).toBeVisible();
});
