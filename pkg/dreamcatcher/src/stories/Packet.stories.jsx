import * as app from '../covenants/app'
import { packet } from '../covenants/faker'
import React from 'react'
import { play, EngineHOC } from '@dreamcatcher-tech/webdos'
import Packet from './Packet'
import Debug from 'debug'
const debug = Debug('Packets')
const install = { add: { path: '/packets', installer: '/dpkg/app/packets' } }
const add = { '/packets/add': packet() }
// const create =
/**
 * Shows a single packet and can optionally be turned into edit mode.
 * This is a datum for a packet.
 *
 * When you edit it, the save process is heavier, since needs to hit the chain.
 *
 * Things a packet can do:
 * 1. Edit it by way of drafting a replacement header
 * 2. See the other attempts to edit it
 * 3. See the funding that has been put into it
 * 4. Propose a solution to it
 * 5. dispute its creation by way of disputing its header
 * 6. dispute any modifications that are approved to happen to it
 * 7.
 *
 * A solution should collapse all areas of a packet, and show edit of that
 * solution only.  This would be saved in the drafts list.
 */

const FirstPacket = ({ crisp }) => <Packet crisp={crisp.tryGetChild('0')} />
FirstPacket.propTypes = Packet.propTypes

export default {
  title: 'Dreamcatcher/Packet',
  component: EngineHOC(FirstPacket),
  args: {
    dev: { '/dpkg/app': app },
    path: '/packets',
  },
  play: play([install, add]),
}
Debug.enable('*Packets  iplog')

export const Basic = {}
