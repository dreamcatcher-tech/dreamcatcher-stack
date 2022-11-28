import React from 'react'
import { App } from '..'
import Debug from 'debug'
const debug = Debug('App')
import * as data from './data'
import PropTypes from 'prop-types'

export default {
  title: 'App',
  component: App,
  args: { base: data.small },
}

const Template = ({ base }) => {
  Debug.enable('*App *Nav *Date')
  debug('complex', base)
  const cd = (path) => {
    debug('cd', path)
    setComplex(complex.setWd(path))
  }
  const [complex, setComplex] = React.useState(base.addAction({ cd }))
  debug('render')
  return <App complex={complex} />
}
Template.propTypes = { base: PropTypes.object }

export const Small = Template.bind({})
export const Medium = Template.bind({})
Medium.args = { base: data.medium }
export const Large = Template.bind({})
Large.args = { base: data.large }

// TODO add customers into the app from large and see how the app responds
export const Growing = Template.bind({})
Growing.args = {}
