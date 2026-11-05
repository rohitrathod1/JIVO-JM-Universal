// 20 messages alice->bob through the UI; bob's page records arrival via MutationObserver. Spaced 700ms (rate limit 20/10s).
module.exports = async ({ P, out, OUT, fs }) => {
  const { alice: A, bob: B } = P; const tag = 'LAT-UI-' + Date.now().toString(36)
  await B.evaluate(tag => { window.__arr = {}; new MutationObserver(() => { for (const el of document.querySelectorAll('[aria-label^="Message from"]')) { const m = (el.innerText || '').match(new RegExp(tag + ' #(\d+)')); if (m && !window.__arr[m[1]]) window.__arr[m[1]] = Date.now() } }).observe(document.body, { subtree: true, childList: true, characterData: true }) }, tag)
  const sent = {}
  for (let i = 1; i <= 20; i++) { await A.getByLabel('Message', { exact: true }).fill(`${tag} #${i}`); sent[i] = Date.now(); await A.getByRole('button', { name: 'Send message', exact: true }).click(); await A.waitForTimeout(700) }
  await B.waitForTimeout(8000)
  const arr = await B.evaluate(() => window.__arr); const lat = []; const missing = []
  for (let i = 1; i <= 20; i++) arr[i] ? lat.push(arr[i] - sent[i]) : missing.push(i)
  const s = [...lat].sort((a, b) => a - b); const order = Object.keys(arr).map(Number).sort((a, b) => arr[a] - arr[b] || a - b)
  const res = { received: lat.length, missing, min: s[0], p50: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)], max: s.at(-1), all: lat, arrivalOrder: order }
  // duplicates on alice side?
  const aliceTexts = await A.getByLabel(/^Message from /).allInnerTexts(); const dup = {}; for (const t of aliceTexts) { const m = t.match(new RegExp(tag + ' #(\d+)')); if (m) dup[m[1]] = (dup[m[1]] || 0) + 1 }
  res.aliceCopies = dup; const bobTexts = await B.getByLabel(/^Message from /).allInnerTexts(); const d2 = {}; for (const t of bobTexts) { const m = t.match(new RegExp(tag + ' #(\d+)')); if (m) d2[m[1]] = (d2[m[1]] || 0) + 1 } res.bobCopies = d2
  res.aliceErrors = await A.getByText(/Not sent|Waiting to send|Too many|slow down/i).count()
  fs.writeFileSync(OUT + '/ui-latency.json', JSON.stringify(res, null, 1)); out(JSON.stringify(res))
  await A.screenshot({ path: OUT + '/03-alice-after-burst.png' })
}
