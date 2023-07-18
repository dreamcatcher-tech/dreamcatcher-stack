import * as app from '../covenants/app'
import React from 'react'
import { CollectionList, EngineHOC } from '@dreamcatcher-tech/webdos'
import Debug from 'debug'
const debug = Debug('Packets')
const install = { add: { path: '/packets', installer: '/dpkg/app/packets' } }

export default {
  title: 'Dreamcatcher/Packets List',
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
