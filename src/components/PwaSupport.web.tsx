import { useEffect, useRef, useState } from 'react'
import { Image, Text, View } from 'react-native'
import { Button, Card, Label, useColors } from '../ui'
import { useSession } from '../core/auth/Session'
import { router, type Href } from 'expo-router'
import { notificationPath } from '../shared/pushPolicy'
import { webPush } from '../modules/notifications/webPush.web'

/** M-08: wait until the person has settled in before suggesting installation (was 4 s after sign-in). */
export const INSTALL_BANNER_DELAY = 45_000

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
    const timer = setTimeout(() => setOpen(true), INSTALL_BANNER_DELAY)
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
    {/* M-08: a small non-modal banner above the tab bar, never a dialog over the chat list right after sign-in. */}
    {open && status === 'ready' && !waiting && <View accessibilityRole="none" aria-live="polite" style={{ position: 'absolute', bottom: 80, left: 16, right: 16, zIndex: 9998, alignItems: 'center', pointerEvents: 'box-none' }}>
      <View role="region" aria-label="Install JIVO JM" style={{ backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, gap: 8, width: '100%', maxWidth: 430, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={{ uri: '/icons/icon-192.png' }} style={{ width: 36, height: 36, borderRadius: 9 }} accessibilityIgnoresInvertColors />
          <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: colors.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 14, lineHeight: 20 }}>Install JIVO JM</Text><Text style={{ color: colors.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{canInstall ? 'Open JM in its own window from your home screen or apps.' : /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'In Safari, tap Share, then Add to Home Screen.' : 'Use your browser menu: Install app or Add to Home screen.'}</Text></View>
        </View>
        {!!installError && <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 12, lineHeight: 16 }}>{installError}</Text>}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <Button size="sm" variant="ghost" title="Not now" accessibilityLabel="Not now, hide the install banner" onPress={dismiss} />
          {canInstall && <Button size="sm" title={busy ? 'Installing…' : 'Install app'} disabled={busy} onPress={() => { void doInstall() }} />}
        </View>
      </View>
    </View>}
  </>
}
