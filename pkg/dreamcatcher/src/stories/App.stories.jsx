import * as app from '../covenants/app'
import {
  generatePacketBatch,
  generateDraftBatch,
  generateChangeBatch,
} from '../covenants/faker'
import App from '../App.jsx'
import { play, EngineHOC } from '@dreamcatcher-tech/webdos'
const cd = (path) => ({ cd: { path: '/app/' + path } })
const add = { add: { path: '/app', installer: '/dpkg/app' } }
const packets = generatePacketBatch(10)
console.log(packets)
const pBatch = { '/app/packets/batch': { batch: generatePacketBatch(10) } }
const dBatch = { '/app/drafts/batch': { batch: generateDraftBatch(10) } }
const cBatch = { '/app/changes/batch': { batch: generateChangeBatch(10) } }
const init = [add, cd('packets'), pBatch, dBatch, cBatch]

export default {
  title: 'Dreamcatcher/App',
  component: EngineHOC(App),
  tags: ['autodocs'],
  args: { dev: { '/dpkg/app': app }, path: '/app' },
  play: play(init),
}

export const Full = {}
export const Packets = {
  play: play([add, cd('packets')]),
}
export const Drafts = {
  play: play([add, cd('drafts')]),
}
export const Changes = {
  play: play([add, cd('changes')]),
}
