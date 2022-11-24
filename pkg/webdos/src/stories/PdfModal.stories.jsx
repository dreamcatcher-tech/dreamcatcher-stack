import React from 'react'
import delay from 'delay'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
import { PdfModal } from '..'
const debug = Debug('webdos:stories:PdfModal')
const { crm } = apps
const runDate = '2022-11-09'
const complex = crm.utils.generateManifest(crm.faker(), runDate)

export default {
  title: 'PDF Modal',
  args: {
    runDate,
    open: true,
    onPdf: (url) => {
      debug('onPdf', url)
    },
    onClose: () => {
      debug('onClose')
    },
  },
}

const Template = (args) => {
  Debug.enable('*PdfModal')
  return <PdfModal {...args} />
}
export const Basic = Template.bind({})
const fakePageCount = 1001
Basic.args = {
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
export const Single = Template.bind({})

export const Multiple = Template.bind({})
