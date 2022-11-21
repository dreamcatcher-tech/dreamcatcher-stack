import React from 'react'
import { PdfInvoice } from '..'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
import img from './Invoice.jpg'
import { Document, PDFViewer } from '@react-pdf/renderer'

const { crm } = apps
let complex = crm.faker().child('customers')
complex = complex.child(complex.network[0].path)

export default {
  title: 'PDF Invoice',
  component: PdfInvoice,
  args: {
    complex,
    img,
  },
}

const Template = (args) => {
  Debug.enable('*PdfInvoice')
  return (
    <PDFViewer width={'100%'} height={'100%'}>
      <Document title="Invoice">
        <PdfInvoice {...args} />
      </Document>
    </PDFViewer>
  )
}

export const Basic = Template.bind({})
