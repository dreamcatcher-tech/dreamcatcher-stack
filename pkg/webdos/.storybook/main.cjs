const path = require('path')
module.exports = {
  stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  features: {
    interactionsDebugger: true, // 👈 Enable playback controls
  },
  async viteFinal(config) {
    const nextConfig = {
      ...config,
      optimizeDeps: {
        ...config.optimizeDeps,
        esbuildOptions: {
          target: 'es2020',
        },
      },
    }
    return nextConfig
  },
}
