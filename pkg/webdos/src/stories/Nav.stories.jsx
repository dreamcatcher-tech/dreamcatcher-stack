import PropTypes from 'prop-types'
import React from 'react'
import { Engine, Syncer } from '..'
import { Nav } from '../components'
import { apps, Crisp } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('Nav')
const init = [{ add: { path: 'crm', installer: '/dpkg/crm' } }]

export default {
  title: 'Nav',
  component: Nav,
  args: { dev: { '/dpkg/crm': apps.crm.covenant }, init, path: '/crm' },
}

const Template = (args) => {
  Debug.enable('*Nav iplog')
  return (
    <Engine {...args}>
      <Syncer path={args.path}>
        <Nav />
      </Syncer>
    </Engine>
  )
}

export const Basic = Template.bind({})

export const Selection = Template.bind({})
Selection.args = { init: [...init, { cd: { path: '/crm/customers' } }] }

export const NoSettings = Template.bind({})
NoSettings.args = { init: [...init, { rm: { path: '/crm/settings' } }] }

const Toggler = ({ crisp, oscillate, isLoaded }) => {
  assert(!(oscillate && isLoaded), 'cannot oscillate and be loaded')
  const [isDeepLoaded, setIsDeepLoaded] = React.useState(isLoaded)
  React.useEffect(() => {
    if (!oscillate) {
      return
    }
    const interval = setInterval(() => {
      setIsDeepLoaded((current) => !current)
    }, 400)
    return () => clearInterval(interval)
  }, [])
  debug('isDeepLoaded', isDeepLoaded)
  if (!crisp.isLoadingActions) {
    const { pulse, actions, chroot } = crisp
    crisp = Crisp.createRoot(pulse, actions, chroot, isDeepLoaded)
  }
  return <Nav crisp={crisp} />
}
Toggler.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  oscillate: PropTypes.bool,
  isLoaded: PropTypes.bool,
}
const LoadingTemplate = (args) => {
  Debug.enable('*Nav iplog')
  return (
    <Engine {...args}>
      <Syncer path={args.path}>
        <Toggler {...args} />
      </Syncer>
    </Engine>
  )
}
export const Loading = LoadingTemplate.bind({})
export const Loaded = LoadingTemplate.bind({})
Loaded.args = { isLoaded: true }
export const Oscilate = LoadingTemplate.bind({})
Oscilate.args = { oscillate: true }
