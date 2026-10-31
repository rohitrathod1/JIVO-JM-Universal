import { nativeExports } from './nativeExport'
import * as DocumentPicker from 'expo-document-picker'
import { validateVaultFile } from './model'
export { cancelVaultExports, retryVaultExportCleanup, watchVaultExportCleanup } from './nativeExport'
export const canSaveVaultFile = true
export async function pickVaultFile(max: number): Promise<{ name: string; body: Blob } | null> {
 const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: false, base64: false })
 if (result.canceled) return null
 const asset = result.assets[0]; validateVaultFile(asset.name, asset.size ?? NaN, max)
 if (!/^(file|content):\/\//i.test(asset.uri)) throw Error('The document provider did not return a local file.')
 const response = await fetch(asset.uri); const body = await response.blob()
 validateVaultFile(asset.name, body.size, max)
 return { name: asset.name, body }
}
export async function saveVaultFile(blob: Blob, name: string, isCurrent: () => boolean) { await nativeExports.export(blob, name, isCurrent) }

export { validateNativeExportSize as validateVaultExportSize } from './exportController'
export const vaultExportNotice = 'Choose only a trusted destination. It can keep a decrypted copy outside the vault. A temporary app copy is removed when sharing closes, or on the next launch after interruption. Exports support up to 20 MiB and expire after two minutes while the app can run. Protect and remove your exported copy when finished.'
