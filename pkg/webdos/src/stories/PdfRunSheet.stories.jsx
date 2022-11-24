import React from 'react'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
import { useRunSheets, useMerge } from '../hooks'
const { crm } = apps
const runDate = '2022-11-01'
// TODO get consistent data
const complex = crm.utils.generateManifest(crm.faker(1000), runDate)

export default {
  title: 'PDF Run Sheet',
  args: {
    complex,
  },
}

const Template = (args) => {
  Debug.enable('*useInvoices *useMerge *useRunSheets')
  const { manifests, count } = useRunSheets(args.complex)
  const url = useMerge(manifests)

  if (!url) {
    return <div>{`count: ${count}`}</div>
  }
  return <iframe src={url} width={'100%'} height={'100%'} />
}

export const Basic = Template.bind({})
