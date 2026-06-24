import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // PDF.js はブラウザ側でのみ動作。canvas (Node.js) モジュールを無効化。
      config.resolve.alias['canvas'] = false
    }
    return config
  },
}

export default nextConfig
