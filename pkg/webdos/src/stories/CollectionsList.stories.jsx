import React from 'react'
import { Engine, Syncer, CollectionList } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import { car } from './data'
import Debug from 'debug'
const debug = Debug('CollectionList')

export default {
  title: 'CollectionList',
  component: CollectionList,
  args: {
    dev: { '/dpkg/crm': apps.crm.covenant },
    path: '/crm/customers',
  },
}

const Template = ({ dev, car, init, path }) => {
  Debug.enable('*CollectionList iplog *Crisp')
  return (
    <Engine dev={dev} car={car} init={init}>
      <Syncer path={path}>
        <CollectionList />
      </Syncer>
    </Engine>
  )
}

export const Loading = Template.bind({})
Loading.args = {
  // TODO make it never load and see how the app responds
}
export const LoadingChildren = Template.bind({})
LoadingChildren.args = {}

export const Empty = Template.bind({})
Empty.args = {
  init: [{ add: { path: 'crm', installer: '/dpkg/crm' } }],
}
export const SmallData = Template.bind({})
SmallData.args = { car: car.small }
export const MediumData = Template.bind({})
MediumData.args = { car: car.medium }
export const LargeData = Template.bind({})
LargeData.args = { car: car.large }
