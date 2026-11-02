const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
const existing = config.resolver.blockList
const root = __dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// CMake caches contain deep generated trees. They are never JavaScript inputs.
// Excluding them also prevents a native build from overwhelming Metro's watcher.
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  new RegExp(`^${root}[\\\\/](?:\\.native-build|android|ios|test-results)(?:[\\\\/]|$)`),
  /[\\/]node_modules[\\/].*[\\/]android[\\/](?:\.cxx|build)(?:[\\/]|$)/,
]

module.exports = config
