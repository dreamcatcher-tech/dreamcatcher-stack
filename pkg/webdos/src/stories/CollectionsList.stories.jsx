import React from 'react'
import { CollectionList } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
const { faker } = apps
import Debug from 'debug'
const debug = Debug('CollectionList')
Debug.enable()

const { datumTemplate: template } = apps.crm.installer.network.customers.state
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
    template,
    rows: [],
  },
}

const Template = (args) => <CollectionList {...args} />

export const Loading = Template.bind({})
Loading.args = {
  loading: true,
}
export const LoadingChildren = Template.bind({})
LoadingChildren.args = {
  rows: [
    { id: 0, custNo: 'custNo-0', name: 'test1' },
    { id: 1, custNo: 'custNo-1' },
  ],
  loading: true,
}

export const Empty = Template.bind({})
Empty.args = {}
export const LargeData = Template.bind({})
LargeData.args = {
  rows: Array(50)
    .fill(0)
    .map((v, id) => ({ id, custNo: `custNo-${id}`, name: `name-${id}` })),
}
export const Sorting = Template.bind({})
Sorting.args = { ...LargeData.args }
