import type { NextConfig } from 'next'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to the nexus monorepo (avoids picking an outer lockfile).
  outputFileTracingRoot: resolve(here, '../..'),
}

export default nextConfig
