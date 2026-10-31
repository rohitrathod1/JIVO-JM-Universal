import * as DocumentPicker from 'expo-document-picker'
import { validateVaultFile } from './model'
export const canSaveVaultFile = true
export async function pickVaultFile(max: number): Promise<{ name: string; body: Blob } | null> {
 const result = await DocumentPicker.getDocumentAsync({ multiple: false, base64: false })
 if (result.canceled) return null
 const asset = result.assets[0]; if (!asset.file) throw Error('The browser did not provide a file.')
 validateVaultFile(asset.name, asset.file.size, max)
 return { name: asset.name, body: asset.file }
}
export async function saveVaultFile(blob: Blob, name: string, isCurrent: () => boolean) {
 if (!isCurrent()) throw Error('Vault export expired or the view lost focus.')
 const url = URL.createObjectURL(blob); const link = document.createElement('a')
 try { link.href = url; link.download = name.replace(/[\/\\]/g, '_'); document.body.appendChild(link); link.click() }
 finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
}

export function watchVaultExportCleanup(_listener: (error: string) => void) { return () => {} }
export function cancelVaultExports() {}
export function retryVaultExportCleanup() {}

export function validateVaultExportSize(_size: number) {}
export const vaultExportNotice = 'This downloads a decrypted copy outside the vault. Protect and remove your downloaded copy when finished.'
