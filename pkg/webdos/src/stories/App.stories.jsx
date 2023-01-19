import React from 'react'
import { Engine, Syncer, App } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import { car } from './data'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('App')

export default {
  title: 'App',
  component: App,
  args: { dev: { '/dpkg/crm': apps.crm.covenant }, car: car.blank },
}

const Template = ({ car }) => {
  Debug.enable('*App *Nav *Date iplog')
  return (
    <Engine car={car}>
      <Syncer path={car.path}>
        <App />
      </Syncer>
    </Engine>
  )
}
Template.propTypes = {
  car: PropTypes.shape({ url: PropTypes.string, path: PropTypes.string }),
}

export const Small = Template.bind({})
Small.args = { car: car.small }
export const Medium = Template.bind({})
Medium.args = { car: car.medium }
export const Large = Template.bind({})
Large.args = { car: car.large }

// TODO add customers into the app from large and see how the app responds
export const Growing = Template.bind({})

// TODO simulate a slow network and see how the app responds
export const Loading = Template.bind({})

export const Install = Template.bind({})
Install.args = {
  init: [{ add: { path: 'crm', installer: '/dpkg/crm' } }],
}
