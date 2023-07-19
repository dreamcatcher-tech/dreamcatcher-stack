import * as app from '../covenants/app'
import { Datum, EngineHOC } from '@dreamcatcher-tech/webdos'
const init = [{ add: { path: '/app', installer: '/dpkg/app' } }]

export default {
  title: 'Dreamcatcher/New',
  component: EngineHOC(Datum),
  tags: ['autodocs'],
  args: { dev: { '/dpkg/app': app }, init, path: '/app' },
}

export const Primary = {}
