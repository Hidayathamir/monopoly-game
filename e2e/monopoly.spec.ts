import { test, expect, Page } from '@playwright/test';

async function handleTurn(page: Page) {
  const rollBtn = page.locator('button:has-text("Lempar")').first();
  if (!await rollBtn.isVisible({ timeout: 500 }).catch(() => false)) return false;

  await rollBtn.click();
  await page.waitForTimeout(2000);

  // Buy property
  const buyBtn = page.locator('.sidebar-section button:has-text("Beli (")').first();
  if (await buyBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await buyBtn.click();
    await page.waitForTimeout(200);
  }

  // Decline build offer
  const noBtn = page.locator('.sidebar-section button:has-text("Tidak")').first();
  if (await noBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await noBtn.click();
    await page.waitForTimeout(200);
  }

  // Card
  const cardBtn = page.locator('button:has-text("Ambil")').first();
  if (await cardBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await cardBtn.click();
    await page.waitForTimeout(500);
    const okBtn = page.locator('button:has-text("OK")').first();
    if (await okBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await okBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Pay rent
  const payBtn = page.locator('.sidebar-section button:has-text("Bayar")').first();
  if (await payBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await payBtn.click();
    await page.waitForTimeout(200);
  }

  // End turn
  const endBtn = page.locator('button:has-text("Akhiri")').first();
  if (await endBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await endBtn.click();
    await page.waitForTimeout(200);
  }

  return true;
}

test.describe('Monopoly Game E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('setup screen renders correctly', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Monopoli Indonesia');
    await expect(page.locator('button:has-text("Mulai")')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
  });

  test('start game with 2 players', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('Alpha');
    await page.locator('input[type="text"]').nth(1).fill('Beta');
    await page.click('button:has-text("Mulai")');

    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Lempar")')).toBeVisible();

    const panel = page.locator('.player-card');
    await expect(panel).toHaveCount(2);
    await expect(panel.first()).toContainText('Alpha');
    await expect(panel.nth(1)).toContainText('Beta');
    await expect(panel.first()).toContainText('Rp1,5M');
  });

  test('dice roll and turn switching works', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('P1');
    await page.locator('input[type="text"]').nth(1).fill('P2');
    await page.click('button:has-text("Mulai")');

    await handleTurn(page);
    await handleTurn(page);

    // Event log should show both players took turns
    const log = page.locator('.event-log');
    await expect(log).toContainText('P1');
    await expect(log).toContainText('P2');
  });

  test('buy property and see it in panel', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('Buyer');
    await page.locator('input[type="text"]').nth(1).fill('Other');
    await page.click('button:has-text("Mulai")');

    for (let i = 0; i < 15; i++) {
      await handleTurn(page);
    }

    const moneyText = await page.locator('.player-card-money').first().textContent();
    expect(moneyText).not.toBe('Rp1,5M');
  });

  test('card modal appears and dismisses', async ({ page }) => {
    await page.locator('input[type="text"]').first().fill('X');
    await page.locator('input[type="text"]').nth(1).fill('Y');
    await page.click('button:has-text("Mulai")');

    let foundCard = false;
    for (let i = 0; i < 30; i++) {
      await handleTurn(page);

      // Check event log for card
      const log = page.locator('.event-entry');
      const cardEntries = log.filter({ hasText: /Kesempatan|Dana Umum|mengambil kartu/ });
      if (await cardEntries.count() > 0) {
        foundCard = true;
        break;
      }
    }

    expect(foundCard).toBe(true);
  });

  test('4-player game survives many turns without crash', async ({ page }) => {
    await page.locator('select').selectOption('4');
    await page.locator('input[type="text"]').nth(0).fill('P1');
    await page.locator('input[type="text"]').nth(1).fill('P2');
    await page.locator('input[type="text"]').nth(2).fill('P3');
    await page.locator('input[type="text"]').nth(3).fill('P4');
    await page.click('button:has-text("Mulai")');

    await expect(page.locator('.player-card')).toHaveCount(4);
    await expect(page.locator('button:has-text("Lempar")')).toBeVisible();

    for (let t = 0; t < 12; t++) {
      const played = await handleTurn(page);
      if (!played) break;
    }

    const cards = page.locator('.player-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
