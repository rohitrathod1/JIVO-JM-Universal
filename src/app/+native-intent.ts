export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try { return new URL(path, 'jivo-jm://local').hostname === 'expo-sharing' ? '/share' : path } catch { return '/' }
}
