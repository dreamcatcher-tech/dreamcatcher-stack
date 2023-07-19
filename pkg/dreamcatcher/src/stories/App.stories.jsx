import * as app from '../covenants/app'
import App from '../App.jsx'
import { play, EngineHOC } from '@dreamcatcher-tech/webdos'
const cd = (path) => ({ cd: { path: '/app/' + path } })
const add = { add: { path: '/app', installer: '/dpkg/app' } }

const init = [add, cd('packets')]

export default {
  title: 'Dreamcatcher/App',
  component: EngineHOC(App),
  tags: ['autodocs'],
  args: { dev: { '/dpkg/app': app }, path: '/app' },
  play: play(init),
}

export const Basic = {}
export const Drafts = {
  play: play([add, cd('drafts')]),
}
export const Changes = {
  play: play([add, cd('changes')]),
}
