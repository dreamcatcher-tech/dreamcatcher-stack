export default {
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
    // storyStoreV7: true, // lazy load each story
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
      build: {
        ...config.build,
        target: 'es2020',
        sourcemap: false,
        minify: false,
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              // makes build-storybook work again
              // if (id.includes('pkg/webdos/src/')) {
              //   return 'webdos'
              // }
              // if (id.includes('pkg/interblock/src/')) {
              //   return 'interblock'
              // }
              // if (id.includes('@mui')) {
              //   console.log(id)
              //   return 'mui'
              // }
              // if (id.includes('faker')) {
              //   return 'faker'
              // }
              return 'vendor'
            },
          },
        },
      },
    }
    return nextConfig
  },
}
