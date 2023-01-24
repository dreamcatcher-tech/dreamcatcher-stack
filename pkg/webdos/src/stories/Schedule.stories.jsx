import React from 'react'
import { Schedule } from '..'
import Debug from 'debug'

export default {
  title: 'Schedule',
  component: Schedule,
  args: {},
}

const Template = (args) => {
  Debug.enable('*Schedule *PdfModal *pdfs')
  return <Schedule {...args} />
}

export const Basic = Template.bind({})
export const Manifest = Template.bind({})
Manifest.args = { expanded: true }
