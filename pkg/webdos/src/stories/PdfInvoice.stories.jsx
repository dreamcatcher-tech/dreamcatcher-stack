import React from 'react'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
import { useInvoices, useMerge } from '../hooks'

// make a proper test invoice without any data attached to it, so can commit it
import pdf from './template.pdf'

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
  Debug.enable('*useInvoices *useMerge')
  const { invoices, isLoading, formsFilled } = useInvoices(pdf, args.customers)
  const url = useMerge(invoices)

  if (!url) {
    return <div>{`isLoading: ${isLoading} formsFilled: ${formsFilled}`}</div>
  }
  return <iframe src={url} width={'100%'} height={'100%'} />
}
export const Single = Template.bind({})
const customersComplex = crm.faker().child('customers')

export const Multiple = Template.bind({})
Multiple.args = {
  customers: Array(5)
    .fill(0)
    .map((_, i) => {
      const { path } = customersComplex.network[i]
      return customersComplex.child(path).state.formData
    }),
}

export const OneThousand = Template.bind({})
const largeCustomers = crm.faker(1000).child('customers')
OneThousand.args = {
  customers: largeCustomers.network.map(
    ({ path }) => largeCustomers.child(path).state.formData
  ),
}
