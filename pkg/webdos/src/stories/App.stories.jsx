import React from 'react'
import { App } from '../components'
import NavStory from './Nav.stories'
import Debug from 'debug'
const debug = Debug('App')

import topProps from './topProps'

export default {
  title: 'App',
  component: App,
  args: NavStory.args,
}

const Template = (args) => {
  Debug.enable('*App *Nav *Date')
  const [wd, setWd] = React.useState(args.wd)
  const cd = (path) => {
    debug('cd', path)
    setWd(path)
  }
  debug('render')
  args = { ...args, actions: { ...args.actions, cd }, wd, ...topProps }
  return <App {...args} />
}

export const Basic = Template.bind({})
Basic.args = {}

console.log(NavStory.args)
