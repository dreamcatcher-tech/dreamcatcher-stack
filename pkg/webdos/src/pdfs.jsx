import delay from 'delay'
import React from 'react'
import { api } from '@dreamcatcher-tech/interblock'
import assert from 'assert-fast'
import { PDFDocument } from 'pdf-lib'
import Debug from 'debug'
const debug = Debug('webdos:pdfs')
export default function (manifests, templateUrl) {
  assert(manifests instanceof api.Complex)
  let pdf, templateArray
  const title = 'Manifest for ' + manifests.state.formData.runDate
  return {
    title,
    prepare: async () => {
      templateArray = await loadUrl(templateUrl)
      pdf = await PDFDocument.create()
      pdf.setTitle(title)
    },
    async *[Symbol.asyncIterator]() {
      let totalPages = estimateTotalPages(manifests)
      for (const { path } of manifests.network) {
        const sector = manifests.child(path)
        const runSheet = await runSheetPdf(sector)
        const indices = runSheet.getPageIndices()
        totalPages += indices.length - 1
        const pages = await pdf.copyPages(runSheet, indices)
        pages.forEach((page) => pdf.addPage(page))
        await delay() // else will hog the loop
        yield totalPages

        for await (const invoice of invoicePdfs(sector, templateArray)) {
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

function estimateTotalPages(manifests) {
  let totalPages = 0
  for (const { path } of manifests.network) {
    totalPages += 1 // run sheet is at least one page
    const sector = manifests.child(path)
    const { rows } = sector.state.formData
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

export async function runSheetPdf(sector) {
  const { rows } = sector.state.formData
  assert(Array.isArray(rows), 'rows must be an array')
  const text = columnify(rows.map(charmapRows), {})
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text>
            Peramble \nCustomers: 10312 Valid emails: 9584 Possibly Not
            Hamilton: 2212
          </Text>
          <Text>
            # | Customer | Address | Invoice | Done | EBC | NABC | Gate | Fence
            | Dog | Vehicle | Delivered Bin | Cancelled Bin
          </Text>
          {rows.map((row, i) => {
            const map = charmapRows(row)
            return (
              <Text key={i}>
                {i} | {map.id} | {map.address} | {map.invoice} | {map.isDone} |
                {map.ebc} | {map.nabc} | {map.isGateLocked} |{map.isFenced} |{' '}
                {map.isDog} | {map.isVehicleBlocking}
                {map.deliveredBin} | {map.cancelledBin}
              </Text>
            )
          })}
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
    fontSize: 14,
  },
  section: {},
})
const charmapRows = (row) => {
  const map = {}
  for (const key in row) {
    if (typeof row[key] === 'boolean') {
      map[key] = row[key] ? 'Y' : 'N'
    } else {
      map[key] = row[key]
    }
  }
  return map
}
