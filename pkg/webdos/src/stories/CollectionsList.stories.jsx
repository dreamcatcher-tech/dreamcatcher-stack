import React from 'react'
import { Engine, Syncer, CollectionList } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('CollectionList')
const { crm } = apps
const add = { add: { path: 'list', installer: '/dpkg/crm/customers' } }
export default {
  title: 'CollectionList',
  component: CollectionList,
  args: {
    dev: { '/dpkg/crm': crm.covenant },
    path: '/list',
    init: [add],
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
  init: [add, { 'list/add': { formData: { name: 'Bob', custNo: 1 } } }],
}
export const MediumData = Template.bind({})
const makeBatch = (start, count = 10) => {
  const batch = []
  for (let i = start; i < start + count; i++) {
    batch.push({ formData: { name: 'Bob', custNo: i } })
  }
  return batch
}
const batches = () => {
  const batch = []
  for (let i = 0; i <= 10; i++) {
    batch.push({
      'list/batch': { batch: crm.faker.customers.generateBatch(10) },
    })
  }
  return batch
}
MediumData.args = {
  init: [add, ...batches()],
}
