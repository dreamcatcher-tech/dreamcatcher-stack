import React from 'react'
import delay from 'delay'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
import generator from '../pdfs'
import { templateUrl } from './data'
import { PdfModal } from '..'
const debug = Debug('webdos:stories:PdfModal')
const { crm } = apps
const runDate = '2022-11-09'
const complex = crm.utils.generateManifest(crm.faker(500), runDate)

export default {
  title: 'PDF Modal',
  args: {
    runDate,
    onPdf: (url) => {
      debug('onPdf', url)
    },
    onClose: () => {
      debug('onClose')
    },
    open: true,
  },
}

const Template = (args) => {
  Debug.enable('*PdfModal *pdfs')
  return <PdfModal {...args} />
}
export const Mocked = Template.bind({})
const fakePageCount = 1001
Mocked.args = {
  generator: {
    prepare: async () => {
      await delay(800)
      return fakePageCount
    },
    async *[Symbol.asyncIterator]() {
      let totalPages = fakePageCount
      for (let i = 0; i < totalPages; i++) {
        if (i % 10 === 0) {
          await delay()
          totalPages++
        }
        yield totalPages
      }
    },
    async save() {
      debug('save')
      await delay(800)
      return { url: 'https://github.com', size: 98000000 }
    },
  },
}
export const Real = Template.bind({})
Real.args = {
  generator: generator(complex, templateUrl),
}
