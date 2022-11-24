import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
describe('pdf', () => {
  test('compress the size', async () => {
    /**
     * Adobe Acrobat inflates the size of the template by about 15x.
     * This appears to be due to the font embedding.
     * Use pdf-lib to copy the pdf then save it makes the size
     * 15x smaller again.
     */
    const array = fs.readFileSync('../../TestInvoice.pdf')
    const pdf = await PDFDocument.load(array)

    const copy = await pdf.copy()
    const copySaved = await copy.save()
    console.log('copySaved', copySaved.length)
    // fs.writeFileSync('copy.pdf', copySaved)
  })
})
