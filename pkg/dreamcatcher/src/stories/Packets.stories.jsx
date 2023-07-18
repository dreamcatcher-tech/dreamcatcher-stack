import * as app from '../covenants/app'
import React from 'react'
import { CollectionList, EngineHOC } from '@dreamcatcher-tech/webdos'
import Debug from 'debug'
const debug = Debug('Packets')
const install = { add: { path: '/packets', installer: '/dpkg/app/packets' } }

export default {
  title: 'Dreamcatcher/Packets',
  component: EngineHOC(CollectionList),
  args: {
    dev: { '/dpkg/app': app },
    path: '/packets',
    init: [install],
  },
}
Debug.enable('*Packets  iplog')

export const Loading = {}
Loading.args = {
  init: undefined,
}
export const Empty = {}

// export const SmallData = Template.bind({})
// SmallData.args = {
//   init: [install, { 'list/add': { formData: { name: 'Bob', custNo: 1 } } }],
// }
// export const MediumData = Template.bind({})
// const batches = () => {
//   const full = crm.faker.customers.generateBatch(100)
//   const batches = []
//   for (let i = 0; i <= 10; i++) {
//     const batch = full.slice(i * 10, (i + 1) * 10)
//     batches.push({ 'list/batch': { batch } })
//   }
//   return batches
// }
// MediumData.args = {
//   init: [install, ...batches()],
// }
