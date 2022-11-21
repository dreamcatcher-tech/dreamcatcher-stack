import React from 'react'
import { PdfRunSheet } from '..'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
import { Document, PDFViewer, usePDF } from '@react-pdf/renderer'
const { crm } = apps
const runDate = '2022-11-09'
const manifest = crm.utils.generateManifest(crm.faker(100), runDate)
// TODO get consistent data
const complex = manifest.child(manifest.network.slice(-1).pop().path)

export default {
  title: 'PDF Run Sheet',
  component: PdfRunSheet,
  args: {
    complex,
  },
}

const Template = (args) => {
  Debug.enable('*PdfRunSheet')
  return (
    <PDFViewer width={'100%'} height={'100%'}>
      <Document>
        <PdfRunSheet {...args} />
      </Document>
    </PDFViewer>
  )
}

export const Basic = Template.bind({})
