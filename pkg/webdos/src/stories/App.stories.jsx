import React from 'react'
import { App } from '../components'
import Debug from 'debug'
const debug = Debug('App')

import Complex from './topProps'

export default {
  title: 'App',
  component: App,
}

const Template = (args) => {
  Debug.enable('*App *Nav *Date')
  debug('complex', Complex)
  const cd = (path) => {
    debug('cd', path)
    setComplex(complex.setWd(path))
  }
  const [complex, setComplex] = React.useState(Complex.addAction({ cd }))
  debug('render')
  return <App complex={complex} />
}

export const Basic = Template.bind({})
Basic.args = {}
