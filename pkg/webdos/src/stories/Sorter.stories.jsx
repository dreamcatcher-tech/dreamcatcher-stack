import React from 'react'
import { apps } from '@dreamcatcher-tech/interblock'
const { faker } = apps.crm
import { Sorter } from '..'
const complex = faker.child('routing').child('13')
console.log(complex)
export default {
  title: 'Sorter',
  component: Sorter,
  parameters: { layout: 'centered' },
  args: {
    complex,
  },
}

const Template = (args) => <Sorter {...args} />

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
export const Blank = Template.bind({})
const blank = { ...complex.state, formData: { ...complex.formData, order: [] } }
Blank.args = { complex: complex.setState(blank) }

export const Dragging = Template.bind({})
