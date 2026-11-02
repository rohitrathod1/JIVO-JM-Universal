import { useEffect, useRef, useState } from 'react'
import { Image, Modal, View } from 'react-native'
import { Button, Card, Label, useColors } from '../ui'
import { useSession } from '../core/auth/Session'
import { router, type Href } from 'expo-router'
import { notificationPath } from '../shared/pushPolicy'
import { webPush } from '../modules/notifications/webPush.web'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
const dismissKey = 'jm.install.dismissedAt'
function standalone() { return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true }
function recentlyDismissed() {
  try { return Date.now() - Number(localStorage.getItem(dismissKey) || 0) < 7 * 86400000 } catch { return false }
}

/** Public shell only; the service worker never stores sessions, messages or vault data. */
export function PwaSupport() {
  const { status } = useSession()
  const colors = useColors()
  const install = useRef<InstallPrompt | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [open, setOpen] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [busy, setBusy] = useState(false)
  const [installError, setInstallError] = useState('')
  const requestedReload = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const message = (event: MessageEvent) => {
      const source = event.source as ServiceWorker | null
      if (!source?.scriptURL || new URL(source.scriptURL).origin !== window.location.origin || new URL(source.scriptURL).pathname !== '/sw.js' || event.origin && event.origin !== window.location.origin) return
      if (event.data?.type === 'JM_PUSH_NAVIGATE') router.push(notificationPath(event.data.url) as Href)
      if (event.data?.type === 'JM_PUSH_CHANGED') void webPush.sync()
    }
    const resume = () => { void webPush.sync() }
    navigator.serviceWorker.addEventListener('message', message); window.addEventListener('focus', resume)
    return () => { navigator.serviceWorker.removeEventListener('message', message); window.removeEventListener('focus', resume) }
  }, [])

  useEffect(() => {
    if (__DEV__ || !window.isSecureContext || !('serviceWorker' in navigator)) return
    let disposed = false
    let registration: ServiceWorkerRegistration | undefined
    let timer: ReturnType<typeof setInterval> | undefined
    const changed = () => { if (requestedReload.current) window.location.reload() }
    const check = () => { if (registration?.waiting) setWaiting(registration.waiting) }
    const found = () => {
      const worker = registration?.installing
      worker?.addEventListener('statechange', () => { if (!disposed && worker.state === 'installed' && navigator.serviceWorker.controller) check() })
    }
    navigator.serviceWorker.addEventListener('controllerchange', changed)
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(value => {
      if (disposed) return
      registration = value
      check()
      registration.addEventListener('updatefound', found)
      timer = setInterval(() => { void registration?.update().catch(() => undefined) }, 3600000)
    }).catch(() => { /* Online use remains available if browser storage is blocked. */ })
    return () => { disposed = true; clearInterval(timer); registration?.removeEventListener('updatefound', found); navigator.serviceWorker.removeEventListener('controllerchange', changed) }
  }, [])

  useEffect(() => {
    if (__DEV__) return
    const beforeInstall = (event: Event) => { event.preventDefault(); install.current = event as InstallPrompt; setCanInstall(true) }
    const installed = () => { install.current = null; setCanInstall(false); setOpen(false) }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', installed)
    return () => { window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', installed) }
  }, [])

  useEffect(() => {
    if (__DEV__ || status !== 'ready' || standalone() || recentlyDismissed() || !window.isSecureContext) return
    const timer = setTimeout(() => setOpen(true), 4000)
    return () => clearTimeout(timer)
  }, [status])

  const dismiss = () => { setOpen(false); try { localStorage.setItem(dismissKey, String(Date.now())) } catch { /* optional preference */ } }
  const doInstall = async () => {
    const prompt = install.current
    if (!prompt) return
    setBusy(true)
    setInstallError('')
    try { await prompt.prompt(); await prompt.userChoice; dismiss() }
    catch { setInstallError('Installation could not open. Use your browser menu to install JM.') }
    finally { install.current = null; setCanInstall(false); setBusy(false) }
  }
  return <>
    {waiting && <View style={{ position: 'absolute', bottom: 80, left: 16, right: 16, zIndex: 9999, alignItems: 'center' }}><Card><Label>A new version of JM is available.</Label><Label>Save unfinished edits before reloading.</Label><Button title="Reload" onPress={() => { requestedReload.current = true; waiting.postMessage({ type: 'SKIP_WAITING' }) }} /></Card></View>}
    <Modal visible={open && status === 'ready'} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View accessibilityViewIsModal style={{ backgroundColor: colors.panel, borderRadius: 16, padding: 24, gap: 16, width: '100%', maxWidth: 430 }}>
          <Label large>Install JIVO JM</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}><Image source={{ uri: '/icons/icon-192.png' }} style={{ width: 64, height: 64, borderRadius: 16 }} accessibilityIgnoresInvertColors /><View style={{ flex: 1 }}><Label>JIVO JM</Label><Label>Messenger for JIVO · no app store needed</Label></View></View>
          <Label>Open JM in its own window from your home screen or apps.</Label>
          {!!installError && <Label>{installError}</Label>}
          {!canInstall && <Label>{/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'In Safari, tap Share, then Add to Home Screen and Add.' : 'Where your browser supports installation, open its menu and choose Install app or Add to Home screen. On desktop Chrome or Edge, you can also use the install icon in the address bar.'}</Label>}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="ghost" title="Not now" onPress={dismiss} />
            {canInstall && <Button title={busy ? 'Installing…' : 'Install app'} disabled={busy} onPress={() => { void doInstall() }} />}
          </View>
        </View>
      </View>
    </Modal>
  </>
}
