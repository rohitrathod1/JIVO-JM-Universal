/** Reference `.app-backdrop` (Frontend src/index.css): the fixed, subtle brand mesh behind the glass. */
const LIGHT = 'radial-gradient(40rem 30rem at 10% 0%, rgba(134, 239, 172, 0.18), transparent 60%), radial-gradient(36rem 28rem at 95% 15%, rgba(94, 234, 212, 0.12), transparent 60%), radial-gradient(40rem 32rem at 60% 100%, rgba(253, 230, 138, 0.16), transparent 60%), linear-gradient(160deg, #f7f9f7, #f4f8f7 50%, #f9f7f2)'
const DARK = 'radial-gradient(40rem 30rem at 10% 0%, rgba(34, 197, 94, 0.07), transparent 60%), radial-gradient(36rem 28rem at 95% 15%, rgba(20, 184, 166, 0.05), transparent 60%), radial-gradient(40rem 32rem at 60% 100%, rgba(245, 158, 11, 0.05), transparent 60%), linear-gradient(160deg, #0c1210, #0e1614 50%, #12130f)'
export function AppBackdrop({ dark }: { dark: boolean }) {
  return <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: dark ? DARK : LIGHT }} />
}
