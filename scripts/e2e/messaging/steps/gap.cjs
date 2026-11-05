// Does a new message after the missed one make bob fetch the gap (seq 54)?
module.exports = async ({ P, out, OUT }) => { const { alice: A, bob: B } = P
  out('bob TICK before', await B.getByText(/^TICK mw25ieoe/).count())
  const t = 'GAP ' + Date.now().toString(36); await A.getByLabel('Message', { exact: true }).fill(t); await A.getByRole('button', { name: 'Send message', exact: true }).click()
  const got = await B.getByText(t, { exact: true }).waitFor({ timeout: 40000 }).then(() => true, () => false); await B.waitForTimeout(3000)
  out('bob got new msg:', got, 'bob TICK after:', await B.getByText(/^TICK mw25ieoe/).count())
  const texts = (await B.getByLabel(/^Message from /).allInnerTexts()).slice(-4).map(x => x.replace(/\s+/g, ' ')); out(texts)
  await B.screenshot({ path: OUT + '/gap-bob.png' }) }
