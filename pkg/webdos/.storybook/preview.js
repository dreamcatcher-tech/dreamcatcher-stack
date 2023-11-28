import { withConsole } from '@storybook/addon-console'

export default {
  decorators: [(storyFn, context) => withConsole()(storyFn)(context)],
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
}
