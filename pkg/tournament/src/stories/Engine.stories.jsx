import React from 'react'
import { system, api, apps, Crisp } from '@dreamcatcher-tech/interblock'
import { Engine, Syncer } from '@dreamcatcher-tech/webdos'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('tournament:Engine')

const covenant = {
  api: {
    // GO: {}
  },
  reducer: async (request) => {
    debug(request)
  },
}

export default {
  title: 'Engine',
  // component: Actions,
  args: {
    repo: 'interpulse-storybook',
    dev: { '/dpkg/tournament': covenant },
  },
}

const Test = ({ crisp }) => {
  return <div>{JSON.stringify(crisp, null, 2)}</div>
}
Test.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
}

const Template = (args) => {
  Debug.enable('*Engine *Crisp *Syncer iplog* *Nav interpulse')
  return (
    <Engine {...args}>
      <Syncer path="/crm">
        <Test />
      </Syncer>
    </Engine>
  )
}

export const Basic = Template.bind({})
Basic.args = {
  ram: true,
  // TODO make init be a function that does anything at all ?
  init: [{ add: { path: 'app', installer: '/dpkg/tournament' } }],
}
