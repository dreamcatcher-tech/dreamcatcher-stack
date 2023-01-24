import React from 'react'
import { Engine, Syncer, SectorSelector, Glass } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('SectorSelector')
const install = { add: { path: 'routing', installer: '/dpkg/crm/routing' } }
const add = { 'routing/batch': { batch: apps.crm.faker.routing.slice(0, 4) } }

export default {
  title: 'SectorSelector',
  component: SectorSelector,
  args: {
    dev: { '/dpkg/crm': apps.crm.covenant },
    init: [install, add],
    path: '/routing',
  },
}
const Template = (args) => {
  Debug.enable('*SectorSelector iplog ')
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
export const Selected = Template.bind({})
Selected.args = {
  expanded: true,
  init: [install, add, { cd: { path: '/routing/1' } }],
}
export const Blank = Template.bind({})
Blank.args = { init: [install] }
export const Duplicates = Template.bind({})
Duplicates.args = { init: [install, add, add], expanded: true }
export const Full = Template.bind({})
Full.args = {
  init: [install, { 'routing/batch': { batch: apps.crm.faker.routing } }],
  expanded: true,
}
