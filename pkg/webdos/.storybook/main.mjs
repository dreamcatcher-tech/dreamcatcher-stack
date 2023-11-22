import { join, dirname } from 'path'

function getAbsolutePath(value) {
  const result = dirname(require.resolve(join(value, 'package.json')))
  return result
}

const config = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-interactions'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  typescript: {
    // bug in that doesn't like interpulse when it tries to deduce stories
    reactDocgen: false,
  },
}
export default config
