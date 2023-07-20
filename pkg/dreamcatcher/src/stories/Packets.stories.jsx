import { generatePacketBatch } from '../covenants/faker'
import * as app from '../covenants/app'
import React from 'react'
import { CollectionList, EngineHOC } from '@dreamcatcher-tech/webdos'
import Debug from 'debug'
import { Packets } from './Packets'
import Container from '@mui/material/Container'
const debug = Debug('Packets')
const install = { add: { path: '/packets', installer: '/dpkg/app/packets' } }
const batch = { '/packets/batch': { batch: generatePacketBatch(10) } }

export default {
  title: 'Dreamcatcher/Packets',
  component: EngineHOC(Packets),
  args: {
    dev: { '/dpkg/app': app },
    path: '/packets',
    init: [install, batch],
  },
}
Debug.enable('*Packets  iplog')

export const Basic = {}
export const Empty = { args: { init: [install] } }
export const Loading = { args: { init: undefined } }
