import { expect, test } from '@playwright/test';

test('player can finish an approximate typing run', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: /Monkeytype/ })).toBeVisible();

	await page
		.getByLabel('Your typed attempt')
		.fill(
			'The team wanted a typing game where mistakes are allowed, speed matters, and the result only needs to stay recognizably close to the original idea.'
		);
	await expect(page.getByText('Timer running. The keyboard is wobbling.')).toBeVisible();

	await page.getByRole('button', { name: 'Finish this run' }).click();

	await expect(page.getByRole('heading', { name: 'Final result' })).toBeVisible();
	await expect(page.getByText('Run complete')).toBeVisible();
	await expect(page.getByText('Finished. The run is frozen and saved locally.')).toBeVisible();

	const similarityValue = page.getByTestId('similarity-value');
	const effectiveWpmValue = page.getByTestId('effective-wpm-value');

	await expect(similarityValue).toBeVisible();
	await expect(effectiveWpmValue).toBeVisible();

	const similarityText = await similarityValue.textContent();
	const effectiveWpmText = await effectiveWpmValue.textContent();

	expect(Number.parseFloat(similarityText ?? '0')).toBeGreaterThan(0);
	expect(Number.parseFloat(effectiveWpmText ?? '0')).toBeGreaterThan(0);
});
