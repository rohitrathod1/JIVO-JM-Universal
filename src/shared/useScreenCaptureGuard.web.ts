import type { CaptureLevel } from './screenCaptureGuard'

/** Browsers offer no screen-capture control; the web build is a deliberate no-op. */
export function useScreenCaptureGuard(_level: CaptureLevel | false) {}
