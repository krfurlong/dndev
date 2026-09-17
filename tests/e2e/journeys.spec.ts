import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function demo(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Explore an example campaign' }).click();
  await expect(page.getByRole('heading', { name: 'Your adventurers' })).toBeVisible();
}
async function sheet(page: Page, name: string) {
  await page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
    .click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeInViewport();
}
async function tab(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: 'Character sections' })
    .getByRole('button', { name, exact: true })
    .click();
}
async function menu(page: Page, name: string) {
  await page.locator('summary').filter({ hasText: 'Actions' }).click();
  await page.locator('.dropdown-content').getByRole('button', { name, exact: true }).click();
}
async function persisted(page: Page) {
  await expect(
    page.getByRole('status').filter({ hasText: 'Saved on this device' }).first(),
  ).toBeVisible();
}
test('campaign roster, level 10 copying, saves, notes, inventory and archive recovery', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await demo(page);
  await sheet(page, 'Orin Vale');
  await page.getByRole('button', { name: 'Switch character', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Lyra Mosswood/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Lyra Mosswood', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Switch character', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Orin Vale/ })
    .click();
  await tab(page, 'Character');
  await page.getByLabel('Player name', { exact: true }).fill('Copied player');
  await tab(page, 'Inventory');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByLabel('Item name', { exact: true }).fill('Spell scroll');
  await page.getByLabel('Item type').selectOption('scroll');
  await page.getByLabel('Quantity', { exact: true }).fill('3');
  await page.getByLabel('Container / location').fill('Scroll case');
  await page.getByRole('button', { name: 'Save item' }).click();
  await page.getByRole('button', { name: 'Consume Spell scroll', exact: true }).click();
  await expect(page.getByLabel('Spell scroll quantity')).toHaveText('2');
  await page.getByLabel('GP', { exact: true }).fill('42');
  await tab(page, 'Journal');
  const notes = page.getByLabel('Session journal', { exact: true });
  await notes.fill('');
  await notes.pressSequentially('Session 19: Recovered the bronze key.', { delay: 1 });
  await expect(notes).toHaveValue(/bronze key/);
  await persisted(page);
  await expect(page).toHaveURL(new RegExp('/journal$'));
  await page.reload();
  await expect(page).toHaveURL(new RegExp('/journal$'));
  await expect(page.getByLabel('Session journal', { exact: true })).toHaveValue(/bronze key/);
  await menu(page, 'Save now');
  await menu(page, 'Archive character');
  await page.getByRole('button', { name: 'View archived' }).click();
  await sheet(page, 'Orin Vale');
  await menu(page, 'Restore character');
  await page.getByRole('button', { name: 'Show active' }).click();
  await expect(page.getByRole('heading', { name: 'Orin Vale' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('guided level 1 creation advances to level 4 with subclass and ability choices', async ({
  page,
}) => {
  await demo(page);
  await page.getByRole('button', { name: 'New character', exact: true }).click();
  await page.getByLabel('Character name', { exact: true }).fill('Arden Test');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Use standard array' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Athletics', { exact: true }).check();
  await page.getByLabel('Perception', { exact: true }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Create character', exact: true }).click();
  for (const level of [2, 3, 4]) {
    await page.getByRole('button', { name: 'Level up', exact: true }).first().click();
    if (level === 3) {
      const option = page
        .getByLabel('Choose subclass')
        .locator('option')
        .filter({ hasText: 'Champion' })
        .first();
      await page
        .getByLabel('Choose subclass')
        .selectOption((await option.getAttribute('value')) || '');
    }
    if (level === 4) await page.getByLabel('STR increase', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Apply level ' + level, exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await tab(page, 'Character');
  await expect(page.getByLabel('STR base')).toHaveValue('17');
  await expect(page.getByText('Improved Critical', { exact: true })).toBeVisible();
  await expect(page.locator('.class-row')).toContainText('Level 4');
});
test('multiclass restrictions can be deliberately overridden', async ({ page }) => {
  await demo(page);
  await sheet(page, 'Rowan Ashford');
  await tab(page, 'Character');
  await page.getByLabel('CHA base').fill('8');
  await page.getByRole('button', { name: 'Level up', exact: true }).first().click();
  await page.getByLabel('Advance in class').selectOption('paladin');
  await expect(page.getByText('Multiclass prerequisites', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply level 2' })).toBeDisabled();
  await page
    .getByLabel('House-rule override reason')
    .fill('Campaign organizer approved oath training');
  await page.getByRole('button', { name: 'Apply level 2' }).click();
  await expect(page.locator('.class-row').filter({ hasText: 'Paladin' })).toContainText('Level 1');
});
test('expanded sources, custom resources, casting and rest previews', async ({ page }) => {
  await demo(page);
  await sheet(page, 'Cassian Grey');
  await tab(page, 'Character');
  await page.getByRole('button', { name: 'Published options', exact: true }).click();
  await page.getByLabel('Search published content').fill('Cruel');
  await page.locator('.catalog-row').filter({ hasText: 'Cruel' }).first().click();
  await expect(page.locator('.catalog-detail')).toContainText('Darrington Press');
  await page.getByRole('button', { name: 'Add to character' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await tab(page, 'Play');
  await expect(page.getByText('Cruelty dice (d6)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Spend Cruelty dice (d6)', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Resource name').fill('Starlight');
  await page.getByLabel('Maximum amount').fill('4');
  await page.getByLabel('Current amount').fill('0');
  await page.getByLabel('Recovery trigger').selectOption('both');
  await page.getByRole('button', { name: 'Save resource' }).click();
  await page.getByRole('button', { name: 'Take a rest', exact: true }).click();
  await page.getByRole('button', { name: 'Long rest', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Starlight');
  await page.getByRole('button', { name: /Complete .*rest/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await tab(page, 'Spells');
  await page.getByRole('button', { name: 'Find spells' }).click();
  await page.getByLabel('Search published content').fill('Misty Step');
  await page.locator('.catalog-row').filter({ hasText: 'Misty Step' }).first().click();
  await page.getByRole('button', { name: 'Add to character' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page
    .locator('.spell-row')
    .filter({ hasText: 'Misty Step' })
    .first()
    .getByRole('button', { name: 'Cast', exact: true })
    .click();
  await page.getByLabel('Casting resource').selectOption('pact');
  await page.getByRole('button', { name: 'Cast spell', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pact slot 1' })).toHaveClass('spent');
});
test('all appearances preserve layout, keyboard dialog access, and accessible contrast', async ({
  page,
}, info) => {
  await demo(page);
  await sheet(page, 'Lyra Mosswood');
  for (const style of ['Modern', 'Subtle Fantasy', 'Strong Fantasy'])
    for (const mode of ['Light', 'Dark']) {
      await page.getByRole('button', { name: 'Change appearance' }).click();
      await page.getByRole('button', { name: new RegExp('^' + style) }).click();
      await page.getByRole('button', { name: mode, exact: true }).click();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
    }
  await page.getByRole('button', { name: 'Change appearance' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Change appearance' })).toBeFocused();
  await page.screenshot({
    path: 'test-results/' + info.project.name + '-sheet.png',
    fullPage: true,
  });
});
test('offline reopening retains edits and JSON import previews make copies', async ({
  page,
  context,
}) => {
  await demo(page);
  await sheet(page, 'Lyra Mosswood');
  await page.getByLabel('Current HP', { exact: true }).fill('17');
  await expect(page.getByLabel('Current HP', { exact: true })).toHaveValue('17');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('Current HP', { exact: true })).toHaveValue('17');
  await context.setOffline(false);
  const download = page.waitForEvent('download');
  await menu(page, 'Export character');
  const file = await download;
  await page.getByRole('button', { name: 'DnDev campaign home' }).click();
  await page.locator('input[type=file]').setInputFiles((await file.path())!);
  await expect(page.getByRole('dialog')).toContainText('Lyra Mosswood');
  await page.getByRole('button', { name: /Import .*character/ }).click();
  await expect(page.getByRole('heading', { name: 'Lyra Mosswood', exact: true })).toHaveCount(2);
});

test('direct level 10 creation, portrait compression, and reload', async ({ page }) => {
  await demo(page);
  await page.getByRole('button', { name: 'New character', exact: true }).click();
  await page.getByRole('button', { name: 'Enter existing character' }).click();
  await page.getByLabel('Character name', { exact: true }).fill('Copied at Ten');
  await page.getByLabel('Class', { exact: true }).selectOption('artificer');
  await page.getByLabel('Starting level').fill('10');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('INT', { exact: true }).fill('18');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'Starting spells' }).click();
  await page.getByLabel('Search eligible class spells').fill('Cure Wounds');
  await page.getByRole('checkbox', { name: /Cure Wounds/ }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Create character', exact: true }).click();
  await tab(page, 'Character');
  await expect(page.locator('.class-row')).toContainText('Artificer');
  await expect(page.locator('.class-row')).toContainText('Level 10');
  await tab(page, 'Spells');
  await expect(page.locator('.spell-row')).toContainText('Cure Wounds');
  await tab(page, 'Journal');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    canvas.getContext('2d')!.fillRect(0, 0, 512, 512);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Upload portrait').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  const portrait = page.getByRole('img', { name: 'Character portrait' });
  await expect(portrait).toBeVisible();
  expect(
    await portrait.evaluate((img) => (img as HTMLImageElement).naturalWidth),
  ).toBeLessThanOrEqual(384);
  await persisted(page);
  await page.reload();
  await expect(portrait).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('custom class keeps configured advancement and recovery through export', async ({ page }) => {
  await demo(page);
  await sheet(page, 'Rowan Ashford');
  await tab(page, 'Character');
  await page.getByRole('button', { name: 'Add custom class', exact: true }).click();
  await page.getByLabel('Class name', { exact: true }).fill('Star keeper');
  await page.getByLabel('Spellcasting progression', { exact: true }).selectOption('half');
  await page
    .getByLabel('Custom level progression and feature notes')
    .fill('Choose one constellation after each level.');
  await page.getByRole('button', { name: 'Save class track', exact: true }).click();
  await page.getByRole('button', { name: 'Level up', exact: true }).first().click();
  await page.getByLabel('Advance in class').selectOption({ label: 'Star keeper' });
  await page
    .getByLabel('New choices and progression notes')
    .fill('Selected the Lantern constellation.');
  await page.getByRole('button', { name: 'Apply level 3', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.class-row').filter({ hasText: 'Star keeper' })).toContainText(
    'Level 2',
  );
  const download = page.waitForEvent('download');
  await menu(page, 'Export character');
  const exported = await download;
  await page.getByRole('button', { name: 'DnDev campaign home' }).click();
  await page.locator('input[type=file]').setInputFiles((await exported.path())!);
  await expect(page.getByRole('dialog')).toContainText('Star keeper 2');
  await page.getByRole('button', { name: 'Import as new characters', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rowan Ashford', exact: true })).toHaveCount(2);
});
