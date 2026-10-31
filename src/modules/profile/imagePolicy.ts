import type { PickedFile } from '../messenger/media/model'
export function validateProfileImage(asset: PickedFile, purpose: 'avatar' | 'background') {
 if (!['image/jpeg','image/png','image/webp','image/gif'].includes(asset.mime)) throw Error('Choose a JPEG, PNG, WebP or GIF image.')
 const limit = (purpose==='avatar'?16:8)*1024*1024
 if(!Number.isFinite(asset.size)||asset.size<=0||asset.size>limit) throw Error('Choose an image of at most '+(purpose==='avatar'?16:8)+' MB.')
}
