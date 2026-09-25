import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('Le Muids visual smoke control', async ({ page }) => {
  fs.mkdirSync('test-results', { recursive: true });

  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  await page.goto('/le-muids-3d.html', {
    waitUntil: 'domcontentloaded'
  });

  await page.waitForFunction(
    () => window.__DIORAMA_QA__?.ready === true,
    null,
    { timeout: 60000 }
  );

  // Remote swisstopo 3D tiles arrive asynchronously. Wait until both official
  // context layers have actually produced meshes; this catches the exact
  // regression where all houses/trees disappeared while their checkboxes
  // remained enabled.
  await expect.poll(
    async () => page.evaluate(
      () => window.__DIORAMA_QA__?.loadedBuildingMeshes ?? 0
    ),
    { timeout: 45000, message: 'official buildings did not load' }
  ).toBeGreaterThan(0);

  await expect.poll(
    async () => page.evaluate(
      () => window.__DIORAMA_QA__?.loadedVegetationMeshes ?? 0
    ),
    { timeout: 45000, message: 'official vegetation did not load' }
  ).toBeGreaterThan(0);

  const qa = await page.evaluate(() => window.__DIORAMA_QA__);

  // Always persist diagnostics and a perspective screenshot BEFORE assertions
  // so a failed visual gate still leaves enough evidence to debug the scene.
  fs.writeFileSync(
    'test-results/le-muids-qa.json',
    JSON.stringify({ qa, browserErrors }, null, 2)
  );

  await page.screenshot({
    path: 'test-results/le-muids-perspective.png',
    fullPage: true
  });

  console.log('DIORAMA_QA=' + JSON.stringify(qa));

  // Capture the top view before assertions as well, so any failure still
  // leaves both visual perspectives for diagnosis.
  await page.click('#top');
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: 'test-results/le-muids-top.png',
    fullPage: true
  });

  expect(qa.buildingsChecked).toBe(true);
  expect(qa.vegetationChecked).toBe(true);
  expect(qa.realRailLengthM).toBeGreaterThan(90);
  expect(qa.reliefM).toBeGreaterThan(1);

  // Meshes merely existing is not enough: they must actually sit above the
  // terrain inside the diorama after the ECEF -> local vertical alignment.
  expect(qa.raisedBuildingMeshes).toBeGreaterThan(0);
  expect(qa.raisedVegetationMeshes).toBeGreaterThan(0);

  // Tangent continuity guard: if either join goes back towards a near-right
  // angle, the build fails before delivery.
  expect(qa.joinAnglesDeg.north).toBeLessThan(18);
  expect(qa.joinAnglesDeg.south).toBeLessThan(18);

  expect(browserErrors).toEqual([]);
});
