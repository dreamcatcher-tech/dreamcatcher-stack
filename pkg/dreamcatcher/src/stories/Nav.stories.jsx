import * as app from '../covenants/app'
import { Nav, EngineHOC } from '@dreamcatcher-tech/webdos'
const init = [{ add: { path: '/app', installer: '/dpkg/app' } }]

export default {
  title: 'Dreamcatcher/Nav',
  component: EngineHOC(Nav),
  tags: ['autodocs'],
  args: { dev: { '/dpkg/app': app }, init, path: '/app' },
}

export const Primary = {
  args: {},
}
