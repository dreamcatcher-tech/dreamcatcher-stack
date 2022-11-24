import { api } from '@dreamcatcher-tech/interblock'
import assert from 'assert-fast'
import { PDFDocument } from 'pdf-lib'

export default function (manifest, templateUrl) {
  assert(manifest instanceof api.Complex)
  let template, pdf
  return {
    prepare: async () => {
      const array = await fetch(templateUrl).then((res) => res.arrayBuffer())
      template = await PDFDocument.load(array)
      pdf = PDFDocument.create()
    },
    async *[Symbol.asyncIterator]() {
      assert(template)

      const invoices = []
      for (const customer of customers) {
        const invoice = await PDFDocument.load(template)
        await delay()
        const form = invoice.getForm()
        for (const field of form.getFields()) {
          const name = field.getName()
          if (name.startsWith('CustNo')) {
            field.setText(customer.custNo + '')
          }
          if (name === 'Address') {
            field.setText(customer.serviceAddress)
          }
        }
        const pages = invoice.getPageIndices()
        const copied = await merged.copyPages(invoice, pages)
        copied.forEach((page) => merged.addPage(page))
      }
      const array = await merged.save()
      const blob = new Blob([array], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      return url
    },
    async save() {},
  }
}
