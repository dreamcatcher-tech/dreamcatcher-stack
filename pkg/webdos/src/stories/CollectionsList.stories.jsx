import React from 'react'
import { CollectionList } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import data from './data'
const { crm } = apps
import Debug from 'debug'
const debug = Debug('CollectionList')

const complex = data.small.child('customers')
export default {
  title: 'CollectionList',
  component: CollectionList,

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
export const MediumData = Template.bind({})
MediumData.args = { complex: data.medium.child('customers') }
export const LargeData = Template.bind({})
LargeData.args = { complex: data.large.child('customers') }
