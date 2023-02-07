import React from 'react'
import { Engine, Syncer } from '..'
import { CollectionList } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('CollectionList')
const { crm } = apps
const install = { add: { path: 'list', installer: '/dpkg/crm/customers' } }
export default {
  title: 'CollectionList',
  component: CollectionList,
  args: {
    dev: { '/dpkg/crm': crm.covenant },
    path: '/list',
    init: [install],
  },
}

const Template = (args) => {
  Debug.enable('*CollectionList *Syncer iplog')
  return (
    <Engine {...args}>
      <Syncer path={args.path}>
        <CollectionList />
      </Syncer>
    </Engine>
  )
}

export const Loading = Template.bind({})
Loading.args = {
  init: undefined,
}
export const Empty = Template.bind({})
export const SmallData = Template.bind({})
SmallData.args = {
  init: [install, { 'list/add': { formData: { name: 'Bob', custNo: 1 } } }],
}
export const MediumData = Template.bind({})
const batches = () => {
  const full = crm.faker.customers.generateBatch(100)
  const batches = []
  for (let i = 0; i <= 10; i++) {
    const batch = full.slice(i * 10, (i + 1) * 10)
    batches.push({ 'list/batch': { batch } })
  }
  return batches
}
MediumData.args = {
  init: [install, ...batches()],
}
