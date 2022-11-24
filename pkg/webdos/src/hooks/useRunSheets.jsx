import Debug from 'debug'
import React, { useEffect, useState } from 'react'
import assert from 'assert-fast'
import { PDFDocument } from 'pdf-lib'
import delay from 'delay'
import { PageSizes, StandardFonts } from 'pdf-lib'
import columnify from 'columnify'
import {
  pdf,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import { api } from '@dreamcatcher-tech/interblock'

const debug = Debug('webdos:hooks:useInvoices')

const cache = new Map()

/**
 *
 * @param {*} manifest
 * @returns array of PDFDocument instances for each sector
 */
export default function useRunSheets(manifest) {
  assert(manifest instanceof api.Complex, 'manifest must be a Complex')
  const [count, setCount] = useState(0)
  const [manifests, setManifests] = useState()
  useEffect(() => {
    let isActive = true
    const generate = async () => {
      const manifests = []
      for (const link of manifest.network) {
        const sector = manifest.child(link.path)
        const { rows } = sector.state.formData
        assert(Array.isArray(rows), 'rows must be an array')
        console.log('rows', rows.map(charmapRows))
        const text = columnify(rows.map(charmapRows), {})
        console.log(text)
        const doc = (
          <Document>
            <Page size="A4" style={styles.page}>
              <View style={styles.section}>
                <Text>
                  Peramble \nCustomers: 10312 Valid emails: 9584 Possibly Not
                  Hamilton: 2212
                </Text>
                <Text>
                  # | Customer | Address | Invoice | Done | EBC | NABC | Gate |
                  Fence | Dog | Vehicle | Delivered Bin | Cancelled Bin
                </Text>
                {rows.map((row, i) => {
                  const map = charmapRows(row)
                  return (
                    <Text key={i}>
                      {i} | {map.id} | {map.address} | {map.invoice} |{' '}
                      {map.isDone} |{map.ebc} | {map.nabc} | {map.isGateLocked}{' '}
                      |{map.isFenced} | {map.isDog} | {map.isVehicleBlocking}
                      {map.deliveredBin} | {map.cancelledBin}
                    </Text>
                  )
                })}
              </View>
            </Page>
          </Document>
        )
        if (!isActive) {
          return
        }
        const blob = await pdf(doc).toBlob()
        const buffer = await blob.arrayBuffer()
        const pdfDoc = await PDFDocument.load(buffer)
        manifests.push(pdfDoc)
        setCount((count) => count + 1)
      }
      setManifests(manifests)
    }
    generate()
    return () => {
      debug('unload')
      setManifests()
      setCount(0)
    }
  }, [manifest])

  return { manifests, count }
}
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Courier',
    fontSize: 14,
  },
  section: {},
})
const charmapRows = (row) => {
  const {
    invoice,
    isDone,
    ebc,
    nabc,
    isGateLocked,
    isFenced,
    isDog,
    isVehicleBlocking,
  } = row
  return {
    invoice: invoice ? 'X' : '□',
    isDone: isDone ? 'X' : '',
    ebc: ebc ? 'X' : '',
  }
}
