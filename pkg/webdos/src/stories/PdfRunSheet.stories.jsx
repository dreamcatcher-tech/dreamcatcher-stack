import React from 'react'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
const { crm } = apps
const runDate = '2022-11-09'
const manifest = crm.utils.generateManifest(crm.faker(100), runDate)
// TODO get consistent data
const complex = manifest.child(manifest.network.slice(-1).pop().path)

export default {
  title: 'PDF Run Sheet',
  // component: PdfRunSheet,
  args: {
    complex,
  },
}

const Template = (args) => {
  Debug.enable('*PdfRunSheet')
  return <div {...args} />
}

export const Basic = Template.bind({})
