import React from 'react'
import { ScheduleSpeedDial } from '../components'
import Debug from 'debug'
const debug = Debug('ScheduleSpeedDial')

export default {
  title: 'ScheduleSpeedDial',
  component: ScheduleSpeedDial,
  args: { initialOpen: true },
}

const Template = (args) => {
  Debug.enable('*ScheduleSpeedDial')
  const events = { onPrint: (printAll = false) => debug('print', printAll) }
  const [isPublished, setIsPublished] = React.useState(args.isPublished)
  const [isReconciled, setIsReconciled] = React.useState(args.isReconciled)
  const onPublish = () => {
    setIsPublished(true)
  }
  const onUnpublish = () => {
    setIsPublished(false)
  }
  const onReconcile = () => {
    setIsReconciled(true)
  }
  const onUnReconcile = () => {
    setIsReconciled(false)
  }
  if (isPublished) {
    events.onUnpublish = onUnpublish
  } else {
    events.onPublish = onPublish
  }
  if (isReconciled) {
    events.onUnReconcile = onUnReconcile
  } else {
    events.onReconcile = onReconcile
  }
  args.events = events
  return <ScheduleSpeedDial {...args} />
}
export const Closed = Template.bind({})
Closed.args = { initialOpen: false }
export const Schedule = Template.bind({})
Schedule.args = {}
export const Published = Template.bind({})
Published.args = { isPublished: true }
export const Reconciled = Template.bind({})
Reconciled.args = { isPublished: true, isReconciled: true }
