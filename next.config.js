/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Webpack config for the MQTT client (browser WebSocket).
  // The 'mqtt' package references Node built-ins; resolve them to false on the client.
  webpack: (config, { isServer }) => {
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
    return config
  },
}

module.exports = nextConfig
