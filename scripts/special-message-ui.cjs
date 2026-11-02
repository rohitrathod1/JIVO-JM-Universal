const assert = require('node:assert/strict')
const { Buffer } = require('node:buffer')
const { expect } = require('@playwright/test')

// Run inside the authenticated mocked-ui harness, before access is revoked.
// message(id, seq, body, own) is the harness factory; get/setMessages share its live list.
// All map traffic and location fixes are synthetic. No browser is started here.
module.exports = async function specialMessageUi(page, { base, person, message, getMessages, setMessages }) {
  const created = [], edits = [], locations = [], searches = []
  let completed = false
  const place = { name: 'Synthetic meeting point', address: 'Fixture road, Test city', latitude: 28.6139, longitude: 77.209, kind: 'building' }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC8sAAAAASUVORK5CYII=', 'base64')
  const nextSequence = () => Math.max(0, ...getMessages().map(item => item.seq)) + 1
  const jsonEvent = body => ({ title: body.title, starts_at: body.starts_at, ends_at: body.ends_at, place: body.place, description: body.description, link: body.link, reminder_minutes: body.reminder_minutes, place_point: body.place_latitude == null ? null : { latitude: body.place_latitude, longitude: body.place_longitude }, cancelled: false, counts: { going: 0, maybe: 0, not_going: 0 }, my_answer: null })
  const handler = async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
    const send = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    if (path.startsWith('/api/jm/maps/tiles/')) return route.fulfill({ status: 200, contentType: 'image/png', body: png })
    if (path === '/api/jm/maps/search/') { searches.push(url.searchParams.get('q')); return send({ results: [place] }) }
    if (path === '/api/jm/maps/reverse/') return send({ place })
    if (path === '/api/jm/conversations/chat/events/' && method === 'POST') {
      assert.ok(req.headers()['x-csrftoken'], 'Event creation requires CSRF')
      const body = req.postDataJSON(); created.push(body)
      const item = { ...message('event-flow-fixture', nextSequence(), '', true), kind: 'event', client_id: body.client_id, event: jsonEvent(body) }
      item.can = { ...item.can, edit_event: true, respond: true }
      setMessages([...getMessages(), item]); return send(item)
    }
    if (path === '/api/jm/messages/event-flow-fixture/event/' && method === 'PATCH') {
      assert.ok(req.headers()['x-csrftoken'], 'Event editing requires CSRF')
      const body = req.postDataJSON(); edits.push(body)
      const item = getMessages().find(row => row.id === 'event-flow-fixture')
      item.event = body.cancel ? { ...item.event, cancelled: true } : { ...item.event, ...jsonEvent(body) }
      item.updated_at = new Date().toISOString(); return send(item)
    }
    if (path === '/api/jm/messages/event-flow-fixture/event-response/') {
      const item = getMessages().find(row => row.id === 'event-flow-fixture')
      item.event.my_answer = method === 'DELETE' ? null : req.postDataJSON().answer
      item.event.counts = { going: 0, maybe: 0, not_going: 0 }
      if (item.event.my_answer) item.event.counts[item.event.my_answer] = 1
      return send(item.event)
    }
    if (path === '/api/jm/messages/event-flow-fixture/event-answers/') return send([{ answer: 'going', users: [person] }, { answer: 'maybe', users: [] }, { answer: 'not_going', users: [] }])
    if (path === '/api/jm/conversations/chat/locations/' && method === 'POST') {
      assert.ok(req.headers()['x-csrftoken'], 'Location sharing requires CSRF')
      const body = req.postDataJSON(); locations.push(body)
      const { client_id, ...location } = body
      const item = { ...message('location-flow-fixture', nextSequence(), '', true), kind: 'location', client_id, location }
      setMessages([...getMessages(), item]); return send(item)
    }
    return route.fallback()
  }
  const button = name => page.getByRole('button', { name, exact: true }).last()
  async function tool(name) { await button('Conversation options').click(); await button(name).click() }
  async function time(label, hour, minute, meridiem) {
    await button(label).click(); await button('Hour').click(); await button(`hour ${hour}`).click()
    await button('Minute').click(); await button(`minute ${minute}`).click(); await button(meridiem).click(); await button('Apply').click()
  }
  await page.route('**/api/jm/**', handler)
  try {
    await page.goto(base + '/messenger?conversation=chat')
    await button('Conversation options').waitFor()
    await page.evaluate(() => {
      window.__specialGeoDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: success => success({ coords: { latitude: 28.6139, longitude: 77.209, accuracy: 8 } }) } })
    })
    await tool('Create event')
    await expect(button('Send event')).toBeDisabled()
    await page.getByLabel('Event name', { exact: true }).fill('Synthetic planning event')
    await page.getByLabel('Description (optional)', { exact: true }).fill('A fixture-only event')
    await button('Start date').click(); await button('Today').click()
    await time('Start time', '09', '30', 'AM')
    await page.getByRole('switch', { name: 'End date and time', exact: true }).click()
    await button('End date').click(); await button('Today').click()
    await time('End time', '10', '45', 'AM')
    await page.getByLabel('Meeting link (optional)', { exact: true }).fill('javascript:alert(1)')
    await expect(button('Send event')).toBeDisabled()
    await page.getByLabel('Meeting link (optional)', { exact: true }).fill('https://example.invalid/meeting')
    await page.getByLabel('Location (optional)', { exact: true }).fill('Synthetic room')
    await button('Reminder').click(); await button('30 minutes before').click()
    await button('Send event').click()
    await expect(page.getByText('Synthetic planning event', { exact: true })).toBeVisible()
    assert.equal(created.length, 1); assert.ok(created[0].client_id)
    assert.equal(created[0].reminder_minutes, 30)
    assert.equal(Date.parse(created[0].ends_at) - Date.parse(created[0].starts_at), 75 * 60 * 1000)
    const localStart = await page.evaluate(iso => ({ hour: new Date(iso).getHours(), minute: new Date(iso).getMinutes() }), created[0].starts_at)
    assert.deepEqual(localStart, { hour: 9, minute: 30 })

    await button('Edit event').click()
    await page.getByLabel('Event name', { exact: true }).fill('Updated synthetic event')
    await button('Reminder').click(); await button('No reminder').click(); await button('Save event').click()
    await expect(page.getByText('Updated synthetic event', { exact: true })).toBeVisible()
    assert.equal(edits[0].reminder_minutes, null)
    const downloadPromise = page.waitForEvent('download')
    await button('Add to calendar').click()
    const download = await downloadPromise
    assert.match(download.suggestedFilename(), /\.ics$/)
    const stream = await download.createReadStream(); let calendar = ''
    for await (const chunk of stream) calendar += chunk.toString()
    assert.match(calendar, /BEGIN:VCALENDAR/); assert.match(calendar, /SUMMARY:Updated synthetic event/)
    await button('Cancel event').click(); await button('Keep event').click()
    assert.equal(edits.length, 1, 'Dismissing confirmation must not cancel')
    await button('Cancel event').click(); await button('Confirm cancel event').click()
    await expect(page.getByText('Event cancelled', { exact: true }).last()).toBeVisible()
    assert.deepEqual(edits[1], { cancel: true })

    await tool('Share location')
    await page.getByLabel('Search for a place', { exact: true }).fill('Synthetic meeting')
    await page.getByLabel('Search for a place', { exact: true }).press('Enter')
    await page.getByRole('button', { name: /Synthetic meeting point.*Fixture road/ }).click()
    await button('Send this location').click()
    await page.getByLabel('Name (optional)', { exact: true }).fill('Reviewed meeting point')
    await page.getByLabel('Address', { exact: true }).fill('Fixture road, floor 2')
    assert.equal(locations.length, 0, 'Review must not send automatically')
    await button('Send').click()
    await expect(page.getByText('Reviewed meeting point', { exact: true })).toBeVisible()
    assert.ok(searches.includes('Synthetic meeting'))
    assert.equal(locations.length, 1); assert.ok(locations[0].client_id)
    const { latitude, longitude, accuracy, name, address } = locations[0]
    assert.deepEqual({ latitude, longitude, accuracy, name, address }, { latitude: place.latitude, longitude: place.longitude, accuracy: null, name: 'Reviewed meeting point', address: 'Fixture road, floor 2' })
    completed = true
    console.log('PASS event/location: date and time, validated link, reminder, create/edit/calendar/cancel confirmation, backend search, explicit reviewed location send')
  } finally {
    if (completed) {
      setMessages(getMessages().filter(item => !['event-flow-fixture', 'location-flow-fixture'].includes(item.id)))
      await page.goto(base + '/messenger?conversation=chat')
      await button('Conversation options').waitFor()
    }
    await page.unroute('**/api/jm/**', handler)
    await page.evaluate(() => {
      if (window.__specialGeoDescriptor) Object.defineProperty(navigator, 'geolocation', window.__specialGeoDescriptor)
      else delete navigator.geolocation
      delete window.__specialGeoDescriptor
    }).catch(() => {})
  }
}
