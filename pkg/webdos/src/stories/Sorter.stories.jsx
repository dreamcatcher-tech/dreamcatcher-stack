import React from 'react'
import { within, userEvent } from '@storybook/testing-library'

import { Sorter } from '../components'

export default {
  title: 'Sorter',
  component: Sorter,
  parameters: { layout: 'centered' },
  args: {
    items: Array(20)
      .fill()
      .map((_, index) => ({ path: `custNo-${index + 1}` })),
  },
}

const Template = (args) => <Sorter {...args} />

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})

export const Dragging = Template.bind({})
