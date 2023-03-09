import PropTypes from 'prop-types'
import React from 'react'
import { Engine, Syncer } from '..'
import { Nav } from '../components'
import { apps, Crisp } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
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

const Toggler = ({ crisp }) => {
  const [isDeepLoaded, setIsDeepLoaded] = React.useState(false)
  React.useEffect(() => {
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
Toggler.propTypes = { crisp: PropTypes.instanceOf(Crisp) }
export const Loading = (args) => {
  Debug.enable('*Nav iplog')
  return (
    <Engine {...args}>
      <Syncer path={args.path}>
        <Toggler />
      </Syncer>
    </Engine>
  )
}
