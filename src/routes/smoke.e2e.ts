import { expect, test } from '@playwright/test';

// Smoke suite for the M1 skeleton: the course renders, all 14 parts are
// present, navigation works, and the tokenizer demo (the one lab that needs
// no WebGPU) actually tokenizes. Training labs are exercised manually — CI
// runners have no GPU.

test('home page renders the full course', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	await page.goto('/');
	await expect(page).toHaveTitle(/LLMVibes/);
	await expect(page.locator('section[id^="part-"]')).toHaveCount(14);
	expect(await page.locator('div[id^="section-"]').count()).toBeGreaterThanOrEqual(61);
	expect(errors).toEqual([]);
});

test('part pages render standalone', async ({ page }) => {
	await page.goto('/parts/pretraining');
	await expect(page.locator('#section-5-3')).toBeVisible();
	await expect(page.getByRole('button', { name: /Load Quill's lab/ })).toBeVisible();
	await page.goto('/parts/rlvr');
	await expect(page.locator('#section-11-3')).toBeVisible();
});

test('tokenizer demo tokenizes text client-side', async ({ page }) => {
	await page.goto('/parts/tokens');
	const demo = page.locator('textarea');
	await expect(demo).toBeVisible({ timeout: 15_000 });
	await demo.fill('Once upon a time');
	// The token strip shows chips; "Once" begins the default corpus vocab well
	await expect(page.getByText(/characters → \d+ tokens/)).toBeVisible();
});
