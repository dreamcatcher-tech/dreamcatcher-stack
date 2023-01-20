import React from 'react'
import { Engine, Syncer, SectorSelector, Glass } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('SectorSelector')
const init = [{ add: { path: 'crm', installer: '/dpkg/crm' } }]

export default {
  title: 'SectorSelector',
  component: SectorSelector,
  args: {
    args: { dev: { '/dpkg/crm': apps.crm.covenant }, init, path: '/crm' },
  },
}
const Template = (args) => {
  Debug.enable('*SectorSelector iplog')

  return (
    <Glass.Container>
      <Glass.Left>
        <Engine {...args}>
          <Syncer path={args.path}>
            <SectorSelector {...args} />
          </Syncer>
        </Engine>
        <div
          style={{
            flexGrow: 1,
            background: 'red',
            minHeight: '200px',
          }}
        >
          Filler
        </div>
      </Glass.Left>
      <Glass.Center debug />
    </Glass.Container>
  )
}

export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
export const Expanded = Template.bind({})
Expanded.args = { expanded: true }
export const Disabled = Template.bind({})
Disabled.args = { disabled: true }
// export const Blank = Template.bind({})
// Blank.args = { complex: complex.setNetwork([]) }
// export const Duplicates = Template.bind({})
// const item = complex.network[0]
// const network = [item, item, item].map((item, path) => ({
//   ...item,
//   path: `${path}`,
// }))
// Duplicates.args = { complex: complex.setNetwork(network), expanded: true }
