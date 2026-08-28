/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Environment variables for client
  env: {
    NEXT_PUBLIC_MQTT_BROKER: process.env.NEXT_PUBLIC_MQTT_BROKER,
    NEXT_PUBLIC_MQTT_USERNAME: process.env.NEXT_PUBLIC_MQTT_USERNAME,
    NEXT_PUBLIC_MQTT_PASSWORD: process.env.NEXT_PUBLIC_MQTT_PASSWORD,
  },

  // Reduce bundle size by removing console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Image optimization
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
  },

  // Webpack config for the MQTT client (browser WebSocket).
  // The 'mqtt' package references Node built-ins; resolve them to false on the client.
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        child_process: false,
      }
    }

    // Reduce chunk size
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
            },
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name(module) {
                const packageName = module.context.match(
                  /[\\/]node_modules[\\/](.*?)([\\/]|$)/
                )?.[1]
                return `npm.${packageName?.replace('@', '')}`
              },
            },
          },
        },
      }
    }

    return config
  },

  // Enable experimental features
  experimental: {
    optimizePackageImports: ['recharts', 'lucide-react', 'mqtt'],
  },

  // Output configuration
  output: 'standalone',
}

module.exports = nextConfig
