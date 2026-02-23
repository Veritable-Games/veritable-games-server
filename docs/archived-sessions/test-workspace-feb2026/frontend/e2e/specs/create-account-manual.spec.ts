import { test, expect } from '@playwright/test';

const TEST_USER = {
  username: 'cwcorella',
  email: 'cwcorella@gmail.com',
  password: 'x},knR7XuTH;^s3',
  token: 'ca6e55a3f814af3dd85a53af5e6d2f4c23a9db44024aef873c102168979e8c0a',
};

test.describe('Manual Create Account regression check', () => {
  test('Create Account button remains clickable', async ({ page }) => {
    await page.goto(`/auth/register?token=${TEST_USER.token}`);

    const createAccountButton = page.getByRole('button', { name: 'Create Account' });
    await expect(createAccountButton).toBeVisible();
    await expect(createAccountButton).not.toBeDisabled();

    await page.getByLabel('Username *').fill(TEST_USER.username);
    await page.getByLabel('Email Address *').fill(TEST_USER.email);
    await page.getByLabel('Display Name *').fill(TEST_USER.username);
    await page.getByLabel('Password *').fill(TEST_USER.password);
    await page.getByLabel('Confirm Password *').fill(TEST_USER.password);
    await page.getByLabel('Invitation Token *').fill(TEST_USER.token);
    await page.getByLabel('I accept the terms and conditions *').check({ force: true });

    await expect(createAccountButton).toBeEnabled();
    await createAccountButton.click();

    await page.waitForTimeout(1000);
  });
});
