import React from 'react'
import { App } from '..'
import { api } from '@dreamcatcher-tech/interblock'
import * as data from './data'
import PropTypes from 'prop-types'
import delay from 'delay'
import Debug from 'debug'
const debug = Debug('App')

export default {
  title: 'App',
  component: App,
  args: { base: data.small },
}

const Template = ({ base }) => {
  Debug.enable('*App *Nav *Date')
  const cd = (path) => {
    debug('cd', path)
    setComplex((current) => current.setWd(path))
  }
  const [complex, setComplex] = React.useState(base)
  if (complex === base && !base.isLoading) {
    let next = base.addAction({ cd })
    const routing = next.child('routing')
    const network = routing.network.map((child) => {
      const { path } = child
      const set = async (formData) => {
        debug('set', path, formData)
        await delay(1200)
        debug('setting done', path)
        setComplex((current) => {
          const routing = current.child('routing')
          const network = routing.network.map((child) => {
            if (child.path === path) {
              return { ...child, state: { ...child.state, formData } }
            }
            return child
          })
          const next = current.setChild('routing', routing.setNetwork(network))
          next.tree = next
          return next
        })
      }
      return { ...child, actions: { set } }
    })
    debug('setNet', routing.setNetwork(network))
    next = next.setChild('routing', routing.setNetwork(network))
    next.tree = next
    debug('next', next)
    setComplex(next)
  }
  debug('complex', complex)
  return <App complex={complex} />
}
Template.propTypes = { base: PropTypes.instanceOf(api.Complex) }

export const Small = Template.bind({})
export const Medium = Template.bind({})
Medium.args = { base: data.medium }
export const Large = Template.bind({})
Large.args = { base: data.large }

// TODO add customers into the app from large and see how the app responds
export const Growing = Template.bind({})
Growing.args = {}

export const Loading = Template.bind({})
Loading.args = { base: api.Complex.createLoading() }
