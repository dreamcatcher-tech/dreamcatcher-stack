import React from 'react'
import Crm from '../../demo/Crm'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
Debug.enable(' iplog *Datum*  *CollectionList')

export default {
  title: 'WithBlockchain/Terminal',
  component: Crm,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'fullscreen',
  },

  args: {},
}
// wrap it in a blockchain
// set the blockchain to store everything in ram,
// so that it can be rendered in line with other instances
const Template = (args) => <Crm {...args} />

export const Basic = Template.bind({})
Basic.args = {}
