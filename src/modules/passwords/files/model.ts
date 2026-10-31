export function validateVaultFile(name: string, size: number, max: number) {
 if (!name.trim() || /[\r\n\x00]/.test(name)) throw Error('Choose a file with a valid name.')
 if (!Number.isSafeInteger(size) || size <= 0) throw Error('Empty files or unknown file sizes cannot be uploaded.')
 if (!Number.isSafeInteger(max) || max <= 0 || size > max) throw Error('This file exceeds the vault upload limit.')
}
export function previewDuration(seconds: number) { return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 60000) : 0 }
