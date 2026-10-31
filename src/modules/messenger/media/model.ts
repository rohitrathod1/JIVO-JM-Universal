export interface PickedFile { name: string; size: number; mime: string; uri: string; file?: File; dispose?: () => void | Promise<void> }
export function uploadLimitError(file: Pick<PickedFile, 'name' | 'size'>): string | null {
  if (!Number.isFinite(file.size) || file.size < 0) return 'The file size could not be determined.'
  if (/\.(jpe?g|png|webp|gif)$/i.test(file.name) && file.size > 10 * 1024 * 1024) return 'Photos can be at most 10 MB.'
  if (/\.(mp4|m4v|mov|webm)$/i.test(file.name) && file.size > 500 * 1024 * 1024) return 'Videos can be at most 500 MB.'
  return null
}
