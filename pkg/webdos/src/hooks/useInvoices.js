import Debug from 'debug'
import React, { useEffect, useState } from 'react'
import assert from 'assert-fast'
import { PDFDocument } from 'pdf-lib'
import delay from 'delay'

const debug = Debug('webdos:hooks:useInvoices')

const cache = new Map()

export default function useInvoices(templateUrl, customers) {
  assert.strictEqual(typeof templateUrl, 'string')
  assert(Array.isArray(customers))
  const [formsFilled, setFormsFilled] = useState(0)
  const [template, setTemplate] = useState()
  const [invoices, setInvoices] = useState()
  useEffect(() => {
    if (cache.has(templateUrl)) {
      setTemplate(cache.get(templateUrl))
      debug('useInvoice() cache hit')
      return
    }
    const load = async () => {
      const array = await fetch(templateUrl).then((res) => res.arrayBuffer())
      cache.set(templateUrl, array)
      setTemplate(array)
    }
    debug('load template', templateUrl)
    load()
    debug('load template done', templateUrl)
    return () => {
      debug('unload', templateUrl)
      setTemplate()
    }
  }, [templateUrl])

  useEffect(() => {
    if (!template) {
      return
    }
    let isActive = true
    const fillForms = async () => {
      debug('fillForms()')
      const invoices = []
      for (const customer of customers) {
        const invoice = await PDFDocument.load(template)
        await delay()
        setFormsFilled((n) => {
          return n + 1
        })
        if (!isActive) {
          return
        }
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
        form.flatten()
        invoices.push(invoice)
      }
      setInvoices(invoices)
      debug('fillForms() done')
    }
    fillForms()
    return () => {
      isActive = false
      setFormsFilled(0)
    }
  }, [template, customers])

  return { invoices, isLoading: !template, formsFilled }
}
