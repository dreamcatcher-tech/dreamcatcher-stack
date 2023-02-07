import delay from 'delay'
import React from 'react'
import { Crisp } from '@dreamcatcher-tech/interblock'
import assert from 'assert-fast'
import { PDFDocument } from 'pdf-lib'
import Debug from 'debug'
const debug = Debug('webdos:pdfs')
export default function (manifests, templateUrl, sector) {
  assert(manifests instanceof Crisp)
  assert(!sector || manifests.hasChild(sector), `sector ${sector} not found`)
  let pdf, templateArray
  const { runDate } = manifests.state.formData
  let sectorTitle = ''
  if (sector) {
    const child = manifests.child(sector)
    const { name } = child.state.formData
    sectorTitle = ` in sector ${name}`
  }
  const title = 'Manifest for ' + runDate + sectorTitle
  return {
    title,
    prepare: async () => {
      templateArray = await loadUrl(templateUrl)
      pdf = await PDFDocument.create()
      pdf.setTitle(title)
    },
    async *[Symbol.asyncIterator]() {
      let totalPages = estimateTotalPages(manifests, sector)
      for (const { path } of manifests.network) {
        if (sector && path !== sector) {
          continue
        }
        const sectorComplex = manifests.child(path)
        const runSheet = await runSheetPdf(sectorComplex, runDate)
        const indices = runSheet.getPageIndices()
        totalPages += indices.length - 1
        const pages = await pdf.copyPages(runSheet, indices)
        pages.forEach((page) => pdf.addPage(page))
        await delay() // else will hog the loop
        yield totalPages

        for await (const invoice of invoicePdfs(sectorComplex, templateArray)) {
          const indices = invoice.getPageIndices()
          const pages = await pdf.copyPages(invoice, indices)
          pages.forEach((page) => pdf.addPage(page))
          await delay()
          yield totalPages
        }
      }
    },
    async save() {
      return await saveToUrl(pdf)
    },
  }
}
export async function loadUrl(url) {
  const res = await fetch(url)
  return res.arrayBuffer()
}
export async function saveToUrl(pdf) {
  const array = await pdf.save({ objectsPerTick: 20 })
  debug('saved')
  const blob = new Blob([array], { type: 'application/pdf' })
  debug('blob created')
  await delay()
  const url = URL.createObjectURL(blob)
  debug('url created')
  await delay()
  return { url, size: array.byteLength }
}

function estimateTotalPages(manifests, sector) {
  let totalPages = 0
  for (const { path } of manifests.network) {
    if (sector && path !== sector) {
      continue
    }
    totalPages += 1 // run sheet is at least one page
    const sectorComplex = manifests.child(path)
    const { rows } = sectorComplex.state.formData
    totalPages += rows.length
  }
  return totalPages
}

import columnify from 'columnify'
import {
  pdf,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

export async function* invoicePdfs(sector, templateArray) {
  assert(sector instanceof api.Complex)
  const { rows } = sector.state.formData
  assert(Array.isArray(rows), 'rows must be an array')
  const customers = sector.tree.child('customers')
  for (const row of rows) {
    const customer = customers.child(row.id)
    yield invoice(customer.state.formData, templateArray)
  }
}
export async function invoice(customerData, templateArray) {
  // must load each time as .copy() does not copy the form fields
  const invoice = await PDFDocument.load(templateArray)
  const form = invoice.getForm()
  for (const field of form.getFields()) {
    const name = field.getName()
    if (name.startsWith('CustNo')) {
      field.setText(customerData.custNo + '')
    }
    if (name === 'Address') {
      field.setText(customerData.serviceAddress)
    }
  }
  form.flatten()
  return invoice
}

export async function runSheetPdf(sector, runDate) {
  const { rows, name } = sector.state.formData
  assert(Array.isArray(rows), 'rows must be an array')
  const text = columnify(rows.map(charmapRows), {
    columns: ['index', 'id', 'address', 'notes'],
    config: {
      index: { headingTransform: () => '#' },
      id: { headingTransform: () => 'CustNo', align: 'right' },
      address: {
        minWidth: 30,
        maxWidth: 30,
        headingTransform: () => 'Address',
      },
      isInvoice: { headingTransform: () => 'I' },
      isDone: { headingTransform: () => 'Done', align: 'center' },
      isGateLocked: { headingTransform: () => 'Gate', align: 'center' },
      isFenced: { headingTransform: () => 'Fence', align: 'center' },
      isDog: { headingTransform: () => 'Dog' },
      isVehicleBlocking: { headingTransform: () => 'Vehicle', align: 'center' },
    },
  })
  const heading = text.split('\n')[0]
  const body = text.substring(heading.length + 1)
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text>Manifest Date: {runDate}</Text>
          <Text>Sector: {name}</Text>
          <Text>Customers: {rows.length}</Text>
          <Text> </Text>
          <View fixed>
            <Text>{heading}</Text>
            <Text> </Text>
          </View>
          <Text>{body}</Text>
        </View>
      </Page>
    </Document>
  )
  const blob = await pdf(doc).toBlob()
  const buffer = await blob.arrayBuffer()
  const pdfDoc = await PDFDocument.load(buffer)
  return pdfDoc
}
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Courier',
    fontSize: 11,
    padding: 25,
  },
  section: {},
})
const charmapRows = (row, index) => {
  const map = { index: index + 1, isInvoice: '×' }
  for (const key in row) {
    if (typeof row[key] === 'boolean') {
      map[key] = row[key] ? '[X]' : '[ ]'
    } else {
      map[key] = row[key]
    }
  }
  return map
}
