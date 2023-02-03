import React from 'react'
import { Engine, Syncer, Manifest, Glass } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const { crm } = apps
const runDate = '2022-11-09'
const { faker } = apps.crm
const install = { add: { path: '/app', installer: '/dpkg/crm' } }
const batch = faker.routing.generateBatch(5)
const insert = { '/app/routing/batch': { batch } }
const cd = { cd: { path: '/app/schedule/' + runDate, allowVirtual: true } }

export default {
  title: 'Manifest',
  component: Manifest,
  args: {
    expanded: true,
    dev: { '/dpkg/crm': apps.crm.covenant },
    path: '/app',
    init: [install, insert, cd],
  },
}

const Template = (args) => {
  Debug.enable('iplog *CollectionList *Manifest crm:utils *InnerCollection')
  return (
    <Glass.Container>
      <Glass.Center debug>
        <Engine {...args}>
          <Syncer path={args.path}>
            <Syncer.UnWrapper path="schedule">
              <Manifest {...args} />
            </Syncer.UnWrapper>
          </Syncer>
        </Engine>
      </Glass.Center>
    </Glass.Container>
  )
}

export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
export const Expanded = Template.bind({})
export const Empty = Template.bind({})
export const Published = Template.bind({})
export const Reconciled = Template.bind({})
export const Small = Template.bind({})
export const Medium = Template.bind({})
export const Large = Template.bind({})

// saved with modified sectors
// unpublish
// show with some customers that have collecitons against them
