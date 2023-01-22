import React from 'react'
import { Engine, Syncer, CollectionList } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('CollectionList')

const add = { path: 'list', installer: '/dpkg/crm/customers' }
export default {
  title: 'CollectionList',
  component: CollectionList,
  args: {
    dev: { '/dpkg/crm': apps.crm.covenant },
    path: '/list',
    init: [{ add }],
  },
}

const Template = (args) => {
  Debug.enable('*CollectionList *Syncer')
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
  init: [{ add }, { 'list/add': { formData: { name: 'Bob', custNo: 1 } } }],
}
export const MediumData = Template.bind({})
const makeBatch = (start, count = 10) => {
  const batch = []
  for (let i = start; i < start + count; i++) {
    batch.push({ formData: { name: 'Bob', custNo: i } })
  }
  return batch
}
const batches = []
for (let i = 0; i <= 10; i++) {
  const count = 10
  const start = i * count + 1
  batches.push({ 'list/batch': { batch: makeBatch(start, count) } })
}
MediumData.args = {
  init: [{ add }, ...batches],
}
