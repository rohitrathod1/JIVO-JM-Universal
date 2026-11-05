import { beforeEach, expect, it, vi } from 'vitest'
// vi.mock below is hoisted above this import by vitest.
import { queuedMedia } from './queuedMedia.native'
const fs = vi.hoisted(() => ({ files: new Map<string, number>(), dirs: new Set<string>(), copies: vi.fn() }))
vi.mock('expo-file-system', () => {
 const join = (base: string | { uri: string }, name?: string) => (typeof base === 'string' ? base : base.uri) + (name ?? '')
 class Directory {
  uri: string
  constructor(base: string | { uri: string }, name?: string) { this.uri = join(base, name).replace(/\/?$/, '/') }
  get name() { return this.uri.split('/').filter(Boolean).at(-1)! }
  get exists() { return fs.dirs.has(this.uri) || [...fs.files.keys()].some(key => key.startsWith(this.uri)) }
  get size() { return [...fs.files].filter(([key]) => key.startsWith(this.uri)).reduce((n, [, size]) => n + size, 0) }
  create() { fs.dirs.add(this.uri) }
  delete() { for (const key of fs.files.keys()) if (key.startsWith(this.uri)) fs.files.delete(key); for (const key of fs.dirs) if (key.startsWith(this.uri)) fs.dirs.delete(key) }
  list() { return [...new Set([...fs.files.keys()].filter(key => key.startsWith(this.uri)).map(key => key.slice(this.uri.length).split('/')[0]))].map(name => new Directory(this, name)) }
 }
 class File {
  uri: string
  constructor(base: string | { uri: string }, name?: string) { this.uri = join(base, name) }
  get exists() { return fs.files.has(this.uri) }
  get size() { return fs.files.get(this.uri) ?? 0 }
  copy(target: File) { if (!this.exists) throw Error('missing source'); fs.copies(this.uri, target.uri); fs.files.set(target.uri, this.size) }
 }
 return { Directory, File, Paths: { document: { uri: 'file:///app-documents/' } } }
})
const photo = { name: 'photo.jpg', uri: 'file:///temporary/photo.jpg', mime: 'image/jpeg', size: 100 }
beforeEach(() => { fs.files.clear(); fs.dirs.clear(); vi.clearAllMocks(); fs.files.set(photo.uri, photo.size) })
it('keeps an independent durable copy after the picker file is removed', async () => {
 const media = await queuedMedia.save('alice', 'message', 'key', photo)
 fs.files.delete(photo.uri)
 const restored = await queuedMedia.open('alice', 'message', media)
 expect(restored.uri).toContain('app-documents/jm-pending-media/')
 expect(restored.size).toBe(100)
 await queuedMedia.remove('alice', 'message')
 await expect(queuedMedia.open('alice', 'message', media)).rejects.toThrow('missing')
})
it('isolates identical message keys between users and clears old-account files', async () => {
 const media = await queuedMedia.save('alice', 'same', 'same', photo)
 await queuedMedia.save('bob', 'same', 'same', photo)
 await queuedMedia.retain('bob')
 await expect(queuedMedia.open('alice', 'same', media)).rejects.toThrow('missing')
 expect((await queuedMedia.open('bob', 'same', media)).size).toBe(100)
 await queuedMedia.retain(null)
 await expect(queuedMedia.open('bob', 'same', media)).rejects.toThrow('missing')
 expect(fs.files.has(photo.uri)).toBe(true)
})
it('encodes path separators and refuses files over the total offline limit', async () => {
 const media = await queuedMedia.save('../alice', '../../message', '../key', photo)
 expect((await queuedMedia.open('../alice', '../../message', media)).uri).not.toContain('/../')
 await expect(queuedMedia.save('alice', 'large', 'key', { ...photo, size: 501 * 1024 * 1024 })).rejects.toThrow('500 MB')
})
