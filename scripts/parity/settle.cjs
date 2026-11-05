// Wait for every <img> (React Native Web Image keeps a hidden <img> per icon) to finish loading before a
// screenshot, so captures no longer miss icons that were still downloading. Patches page.screenshot in place.
function settleImages(page) {
  const shoot = page.screenshot.bind(page)
  page.screenshot = async options => {
    await page.waitForFunction(() => [...document.images].every(img => img.complete), null, { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(120)
    return shoot(options)
  }
  return page
}
module.exports = { settleImages }
