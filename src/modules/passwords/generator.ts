import { getRandomValues } from 'expo-crypto'

/**
 * Password generator on the device (Expo Crypto `getRandomValues`, rejection sampling: no modulo
 * bias). Nothing generated here is sent anywhere until the person saves the entry.
 */

export const SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!#$%&*+-=?@^_~',
} as const

export type SetName = keyof typeof SETS

/** A uniformly random integer in [0, max). */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) throw new RangeError('max out of range')
  const limit = Math.floor(2 ** 32 / max) * max
  const buf = new Uint32Array(1)
  for (;;) {
    getRandomValues(buf)
    if (buf[0]! < limit) return buf[0]! % max
  }
}

export function generatePassword(length = 20, sets: SetName[] = ['lower', 'upper', 'digits', 'symbols']): string {
  if (!Number.isFinite(length)) throw new RangeError('Choose a finite password length.')
  if (sets.some(set => !Object.prototype.hasOwnProperty.call(SETS, set))) throw new RangeError('Unknown character set.')
  const n = Math.max(16, Math.min(64, Math.floor(length)))
  const chosen = sets.length ? sets : (['lower', 'digits'] as SetName[])
  const alphabet = chosen.map((s) => SETS[s]).join('')
  for (;;) {
    const out = Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join('')
    if (chosen.every((s) => [...out].some((c) => SETS[s].includes(c)))) return out
  }
}

// 313 short, distinct, easy words: each adds ~8.3 bits. Six words + a two-digit number ≈ 56 bits.
const WORDS = (
  'acid acorn actor adapt agent alarm album alert alien alley amber angle ankle apple april apron arena armor ' +
  'arrow aspen atlas attic audio award bacon badge bagel baker bamboo banjo barge basil basin beach beard beast ' +
  'bench berry bison blade blaze blend bloom board boost booth brain brave bread brick bride broom brush buddy ' +
  'cabin cable cacao camel candy canoe cargo carol cedar chalk charm chess chief chili choir cider cinema civic ' +
  'clamp claw clerk cliff cloud clove coach cobra cocoa comet coral couch crane crater cream crest crisp crown ' +
  'cubic curry cycle daisy dance delta denim depot diary dingo disco dock dodge dolphin dough draft dragon drama ' +
  'dream drift drum eagle earth easel echo elbow elder ember emoji enjoy envoy epoch equal error essay ethic ' +
  'fable fairy falcon fancy feast fence ferry fiber field flame flask fleet flint flora flute focus forge ' +
  'fossil frame frost fruit gecko genre ghost giant ginger glade glass globe glove goose grain grape gravy ' +
  'guard guide guitar habit harbor hazel heart hedge hello heron honey horse hotel humor igloo image index ' +
  'inlet ivory jacket jelly jewel joker judge juice jumbo kayak kebab kettle kiosk koala label lamp lantern ' +
  'laser lemon level lilac linen lion llama lobby lotus lunar mango maple marble marsh medal melon metro ' +
  'mint mocha model monk moose motor mural music nacho nectar noble north novel nylon oasis ocean olive ' +
  'omega onion opera orbit otter oxide paddle panda paper parade pasta pearl pedal penny pepper piano pilot ' +
  'pixel plaza plum polar poppy prism pulse quail quartz quest quiet quilt radar radio raven razor relay ' +
  'rhino ridge robin rocket rodeo rover ruby saber salad salsa sauna scarf scout shelf shrub sierra silk ' +
  'siren sketch slate sloth smile solar sonic spark spice spoon squid stamp steam stork sugar sunny swamp ' +
  'syrup table tango tiger toast topaz torch tower tulip tundra turbo ultra umbra unity urban vapor velvet'
)
  .split(' ')
  .filter(Boolean)

export const WORD_COUNT = WORDS.length

export function generatePassphrase(words = 6): string {
  if (!Number.isFinite(words)) throw new RangeError('Choose a finite word count.')
  const n = Math.max(4, Math.min(10, Math.floor(words)))
  const picked = Array.from({ length: n }, () => WORDS[randomInt(WORDS.length)]!)
  return `${picked.join('-')}-${randomInt(90) + 10}`
}
