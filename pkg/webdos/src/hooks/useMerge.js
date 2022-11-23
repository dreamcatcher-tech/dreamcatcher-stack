import assert from 'assert-fast'
import { useEffect, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import Debug from 'debug'
const debug = Debug('webdos:hooks:useMerge')

export default function useMerge(pdfs = []) {
  assert(Array.isArray(pdfs))
  const [mergedUrl, setMergedUrl] = useState()
  useEffect(() => {
    if (!pdfs.length) {
      return
    }
    const merge = async () => {
      debug('merge start')
      const merged = await PDFDocument.create()
      for (const pdf of pdfs) {
        const pages = pdf.getPageIndices()
        const copied = await merged.copyPages(pdf, pages)
        copied.forEach((page) => merged.addPage(page))
      }
      debug('pages copied')

      const array = await merged.save()
      debug('saved', array.length)
      const blob = new Blob([array], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setMergedUrl(url)
      debug('merge done')
    }
    merge()
  }, [pdfs])
  return mergedUrl
}
