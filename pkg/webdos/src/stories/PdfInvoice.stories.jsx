import React from 'react'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
import { saveToUrl, loadUrl, invoice } from '../pdfs'
import { useAsync } from 'react-async-hook'
import { templateUrl } from './data'
const debug = Debug('PdfInvoice')
const { crm } = apps
let complex = crm.faker().child('customers')
complex = complex.child(complex.network[0].path)

export default {
  title: 'PDF Invoice',
  args: {
    customers: [complex.state.formData],
  },
}

const Template = (args) => {
  Debug.enable('*PdfInvoice')
  const [template, setTemplate] = React.useState()
  useAsync(async () => {
    debug('loading template', templateUrl)
    const template = await loadUrl(templateUrl)
    debug('template loaded', template.byteLength)
    setTemplate(template)
  })

  const [invoiceUrl, setInvoiceUrl] = React.useState()
  useAsync(async () => {
    debug('generating invoice')
    const pdf = await invoice(complex.state.formData, template)
    debug('invoice generated', pdf)
    const { url, size } = await saveToUrl(pdf)
    debug('invoice size', size)
    setInvoiceUrl(url)
  }, [template])
  if (!template) return <div>Loading Template...</div>
  if (!invoiceUrl) return <div>Loading Invoice...</div>
  return <iframe src={invoiceUrl} width={'100%'} height={'100%'} />
}
export const Basic = Template.bind({})
