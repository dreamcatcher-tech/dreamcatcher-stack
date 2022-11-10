import React from 'react'
import { CollectionList } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
const { crm } = apps
import Debug from 'debug'
const debug = Debug('CollectionList')

const complex = crm.faker().child('customers')
export default {
  title: 'CollectionList',
  component: CollectionList,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'fullscreen',
  },

  args: {
    onAdd: () => {
      return new Promise((r) => setTimeout(r, 1000))
    },
    onRow: () => {},
    complex,
  },
}

const Template = (args) => {
  Debug.enable('*CollectionList')
  return <CollectionList {...args} />
}

export const Loading = Template.bind({})
Loading.args = {
  complex: complex.setNetwork([]).setIsLoading(true),
}
export const LoadingChildren = Template.bind({})
LoadingChildren.args = {
  complex: complex.setIsLoading(true),
}

export const Empty = Template.bind({})
Empty.args = { complex: complex.setNetwork([]) }
export const SmallData = Template.bind({})
SmallData.args = { complex: complex.setNetwork(complex.network.slice(0, 5)) }
export const LargeData = Template.bind({})
