import * as app from '../covenants/app'
import React from 'react'
import { EngineHOC } from '@dreamcatcher-tech/webdos'
import Packet from './Packet'
import Debug from 'debug'
const debug = Debug('Packets')
const install = { add: { path: '/packets', installer: '/dpkg/app/packets' } }
// const create =
/**
 * Shows a single packet and can optionally be turned into edit mode.
 * This is a datum for a packet.
 *
 * When you edit it, the save process is heavier, since needs to hit the chain.
 */

export default {
  title: 'Dreamcatcher/Packet',
  component: EngineHOC(Packet),
  args: {
    dev: { '/dpkg/app': app },
    path: '/packets',
    init: [install],
  },
}
Debug.enable('*Packets  iplog')

export const Basic = {}
