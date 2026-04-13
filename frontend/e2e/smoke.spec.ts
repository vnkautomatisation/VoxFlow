import { test, expect } from '@playwright/test'

test.describe('VoxFlow Smoke Tests', () => {

  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('text=Connexion')).toBeVisible()
    await expect(page.locator('text=Se connecter')).toBeVisible()
    await expect(page.locator('input[type="email"], input[placeholder*="company"]')).toBeVisible()
  })

  test('login shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"], input[placeholder*="company"]', 'wrong@test.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('text=Se connecter')
    // Should show error (either network or invalid creds)
    await expect(page.locator('text=/incorrect|serveur|Erreur/')).toBeVisible({ timeout: 10000 })
  })

  test('dialer page loads', async ({ page }) => {
    await page.goto('/dialer')
    await expect(page.locator('text=VoxFlow')).toBeVisible()
    // Either login view or main dialer view
    const hasKeypad = await page.locator('.kpad').count()
    const hasLogin = await page.locator('text=Se connecter').count()
    expect(hasKeypad + hasLogin).toBeGreaterThan(0)
  })

  test('register page loads', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('text=VoxFlow')).toBeVisible()
  })

  test('no console errors on login page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    await page.goto('/login')
    await page.waitForTimeout(2000)
    // Filter out known non-critical errors
    const critical = errors.filter(e => !e.includes('RSC payload') && !e.includes('favicon'))
    expect(critical).toHaveLength(0)
  })

  test('admin dashboard redirects to login without auth', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForURL('**/login**', { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

  test('owner dashboard redirects to login without auth', async ({ page }) => {
    await page.goto('/owner/dashboard')
    await page.waitForURL('**/login**', { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

})
