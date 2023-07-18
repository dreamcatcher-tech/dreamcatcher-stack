import * as app from '../covenants/app'
import App from '../App.jsx'
import { EngineHOC } from '@dreamcatcher-tech/webdos'
const init = [{ add: { path: '/app', installer: '/dpkg/app' } }]

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction
export default {
  title: 'Dreamcatcher/App',
  component: EngineHOC(App),
  tags: ['autodocs'],
  args: { dev: { '/dpkg/app': app }, init, path: '/app' },
}

export const Basic = {}
