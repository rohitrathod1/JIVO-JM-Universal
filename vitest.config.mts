import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Tooling uses Node's test runner through tsx; application tests use Vitest.
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
