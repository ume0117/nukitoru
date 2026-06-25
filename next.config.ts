import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias['canvas'] = false
    }
    // zbar-wasm の WebAssembly ファイルを非同期ロードするために必要
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }
    return config
  },
}

export default nextConfig
