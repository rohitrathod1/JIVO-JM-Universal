import { Directory, File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { randomUUID } from 'expo-crypto'
import { AppState, Platform } from 'react-native'
import { NativeExportController } from './exportController'
export function createNativeExporter(folder: 'jivo-vault-exports' | 'jivo-message-exports', title: string, label: string) {
function root() {
 const cache = Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`
 const directory = new Directory(Paths.cache, folder)
 if (directory.uri.replace(/\/$/, '') !== `${cache}${folder}`) throw Error('Invalid vault export cache path.')
 return directory
}
function encode(blob: Blob): Promise<string> {
 return new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(Error('Could not read the downloaded vault file.'))
  reader.onabort = () => reject(Error('Vault file read was cancelled.'))
  reader.onload = () => { const result = reader.result; if (typeof result !== 'string' || !/^data:[^,]*;base64,/.test(result)) { reject(Error('Unsupported vault file encoding.')); return } resolve(result.slice(result.indexOf(',') + 1)) }
  reader.readAsDataURL(blob)
 })
}
return new NativeExportController({
 available: Sharing.isAvailableAsync,
 encode,
 stage(name, data) {
  const directory = root(); directory.create({ intermediates: true, idempotent: true })
  const session = new Directory(directory, randomUUID()); session.create()
  const file = new File(session, name)
  if (!file.uri.startsWith(`${directory.uri.replace(/\/$/, '')}/`)) throw Error('Invalid vault export path.')
  file.create(); file.write(data, { encoding: 'base64' }); return file.uri
 },
 share: uri => Sharing.shareAsync(uri, Platform.OS === 'android' ? { mimeType: 'application/octet-stream', dialogTitle: title } : { dialogTitle: title }),
 purge() { const directory = root(); if (directory.exists) directory.delete(); if (directory.exists) throw Error('Vault export cache still exists.') },
}, label)
}
export const nativeExports = createNativeExporter('jivo-vault-exports', 'Export decrypted vault file', 'vault')
export function watchVaultExportCleanup(listener: (error: string) => void) {
 const off = nativeExports.subscribe(listener)
 const clean = () => { try { nativeExports.resume() } catch { /* The controller publishes cleanup failures. */ } }
 clean(); const sub = AppState.addEventListener('change', state => { if (state === 'active') clean() })
 return () => { off(); sub.remove() }
}
export function cancelVaultExports() { try { nativeExports.cancel() } catch { /* Visible through cleanup subscription. */ } }
export function retryVaultExportCleanup() { try { nativeExports.cleanupIdle() } catch { /* Visible through cleanup subscription. */ } }
