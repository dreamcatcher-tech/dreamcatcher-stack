import * as React from 'react'
import Button from '@mui/material/Button'
import * as app from '../covenants/app'
import { packet } from '../covenants/faker'
import { play, EngineHOC } from '@dreamcatcher-tech/webdos'
import Packet from './Packet'
import Debug from 'debug'
const debug = Debug('Packets')
const install = { add: { path: '/packets', installer: '/dpkg/app/packets' } }
const add = { '/packets/add': packet() }

const FirstPacket = ({ crisp }) => {
  if (crisp.isLoading || !crisp.hasChild('0')) {
    return
  }

  const handleClickOpen = () => {
    crisp.actions.cd('/packets/0')
  }
  const isSelected = crisp.getSelectedChild() == '0'
  const crispPacket = isSelected ? crisp.tryGetChild('0') : undefined
  console.log('crispPacket', crispPacket, crisp.wd)
  return (
    <div>
      CD: {crisp.wd} <br />
      <Button variant="outlined" onClick={handleClickOpen}>
        Open full-screen packet dialog
      </Button>
      <Packet crisp={crispPacket} />
    </div>
  )
}
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
Debug.enable('*Packet  iplog')

export const Basic = {}
export const Open = { play: play([install, add, { cd: '/packets/0' }]) }
