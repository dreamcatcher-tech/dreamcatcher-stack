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

export default {
  title: 'Dreamcatcher/App',
  component: EngineHOC(App, '*:List'),
  args: { dev: { '/dpkg/app': app }, path: '/app' },
}

export const Packets = {
  play: play([add, cd('packets'), pBatch, cBatch, dBatch]),
}
export const Drafts = {
  play: play([add, cd('drafts'), dBatch, cBatch, pBatch]),
}
export const Changes = {
  play: play([add, cd('changes'), cBatch, pBatch, dBatch]),
}
