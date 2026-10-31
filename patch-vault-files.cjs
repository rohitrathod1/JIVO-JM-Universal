const fs=require('node:fs');
fs.mkdirSync('src/modules/passwords/files',{recursive:true});
fs.writeFileSync('src/modules/passwords/files/model.ts',`export function validateVaultFile(name: string, size: number, max: number) {
 if (!name.trim() || /[\\r\\n\\x00]/.test(name)) throw Error('Choose a file with a valid name.')
 if (!Number.isSafeInteger(size) || size <= 0) throw Error('Empty files or unknown file sizes cannot be uploaded.')
 if (!Number.isSafeInteger(max) || max <= 0 || size > max) throw Error('This file exceeds the vault upload limit.')
}
export function previewDuration(seconds: number) { return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 60000) : 0 }
`);
fs.writeFileSync('src/modules/passwords/files/transfer.ts',`import * as DocumentPicker from 'expo-document-picker'
import { validateVaultFile } from './model'
export const canSaveVaultFile = false
export async function pickVaultFile(max: number): Promise<{ name: string; body: Blob } | null> {
 const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: false, base64: false })
 if (result.canceled) return null
 const asset = result.assets[0]; validateVaultFile(asset.name, asset.size ?? NaN, max)
 if (!/^(file|content):\\/\\//i.test(asset.uri)) throw Error('The document provider did not return a local file.')
 const response = await fetch(asset.uri); const body = await response.blob()
 validateVaultFile(asset.name, body.size, max)
 return { name: asset.name, body }
}
export async function saveVaultFile(_blob: Blob, _name: string) { throw Error('Secure native file export is not configured. Use the web client to download this file.') }
`);
fs.writeFileSync('src/modules/passwords/files/transfer.web.ts',`import * as DocumentPicker from 'expo-document-picker'
import { validateVaultFile } from './model'
export const canSaveVaultFile = true
export async function pickVaultFile(max: number): Promise<{ name: string; body: Blob } | null> {
 const result = await DocumentPicker.getDocumentAsync({ multiple: false, base64: false })
 if (result.canceled) return null
 const asset = result.assets[0]; if (!asset.file) throw Error('The browser did not provide a file.')
 validateVaultFile(asset.name, asset.file.size, max)
 return { name: asset.name, body: asset.file }
}
export async function saveVaultFile(blob: Blob, name: string) {
 const url = URL.createObjectURL(blob); const link = document.createElement('a')
 try { link.href = url; link.download = name.replace(/[\\/\\\\]/g, '_'); document.body.appendChild(link); link.click() }
 finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
`);
let api=fs.readFileSync('src/modules/passwords/api.ts','utf8');api=api.replace('file: File, onProgress?', 'file: Blob & { name?: string }, onProgress?').replace('signal?: AbortSignal) =>\n  (await api.put<VaultFile>', "signal?: AbortSignal, name = file.name ?? 'file') =>\n  (await api.put<VaultFile>").replace("encodeURIComponent(file.name)","encodeURIComponent(name)");fs.writeFileSync('src/modules/passwords/api.ts',api);
