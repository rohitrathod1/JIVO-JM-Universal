import type { LinkPreview } from './api'

/** Only the backend's small re-encoded data: pictures are shown; anything else (remote URL, huge payload) is dropped. */
export function safePreviewImage(image: string | null | undefined): string | null {
  return image && image.length <= 350000 && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(image) ? image : null
}

/** Compact composer card text, mirroring the reference LinkPreviewCard (title or domain, description, site). */
export function previewLines(preview: LinkPreview) {
  return { title: preview.title.trim() || preview.domain, description: preview.description.trim(), site: preview.site_name.trim() || preview.domain }
}
