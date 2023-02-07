import React, { useMemo, useState, useRef } from 'react'
import PropTypes from 'prop-types'
import calculateSize from 'calculate-size'
import { Crisp } from '@dreamcatcher-tech/interblock'
import { DataGridPremium } from '@mui/x-data-grid-premium/DataGridPremium'
import assert from 'assert-fast'
import Debug from 'debug'
import FabAdd from './FabAdd'

const debug = Debug('terminal:widgets:CollectionList')

const CollectionList = ({ crisp }) => {
  // TODO assert the complex has a collection as its covenant
  const [isAdding, setIsAdding] = useState(false)
  assert(crisp.isLoading || typeof crisp.covenant === 'string')

  const crispRef = useRef()
  crispRef.current = crisp

  const onAddCustomer = async () => {
    assert(!isAdding)
    assert(!crisp.isLoadingActions)
    debug(`addCustomer `)
    // TODO show an enquiring modal UI over the top to get the data we need
    setIsAdding(true)
    const { add } = crisp.actions
    await add({ formData: { name: 'bob' } })
    setIsAdding(false)
  }
  const valueGetter = ({ id, field }) => {
    const crisp = crispRef.current
    if (!crisp.hasChild(id)) {
      return '..'
    }
    const child = crisp.getChild(id)
    if (!child.isLoading && child.state.formData) {
      return child.state.formData[field]
    }
    return '...'
  }
  const template = crisp.isLoading ? {} : crisp.state.template
  const columns = useMemo(() => {
    if (crisp.isLoading) {
      return []
    }
    return generateColumns(crisp.state.template, valueGetter)
  }, [template])
  const rows = useMemo(() => {
    if (crisp.isLoading) {
      return []
    }
    const rows = [...crisp]
      .sort((a, b) => {
        const ai = Number.parseInt(a)
        const bi = Number.parseInt(b)
        if (Number.isInteger(ai) && Number.isInteger(bi)) {
          return ai - bi
        }
        if (Number.isInteger(ai)) {
          return 1
        }
        if (Number.isInteger(bi)) {
          return -1
        }
        return a.localeCompare(b)
      })
      .map((id) => ({ id }))
    debug('rows generated', rows)
    return rows
  }, [crisp])

  const onRow = (params) => {
    debug('onRow', params)
  }
  const onAdd = crisp.isLoadingActions ? null : crisp.actions.add
  return (
    <>
      <DataGridPremium
        sx={{ height: '100%', width: '100%' }}
        backgroundColor="paper"
        columns={columns}
        rows={rows}
        disableMultipleSelection
        hideFooter
        onRowClick={onRow}
        loading={crisp.isLoading}
      />
      {onAdd ? <FabAdd onClick={onAddCustomer} disabled={isAdding} /> : null}
    </>
  )
}
CollectionList.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
}

const generateColumns = (template, valueGetter) => {
  assert.strictEqual(typeof valueGetter, 'function')
  debug(`generating columns`, template)
  const columns = []
  if (!template || !template.schema) {
    return columns
  }
  // TODO get nested children columns out, hiding all but top level
  const { properties } = template.schema
  const { uiSchema = {} } = template
  for (const key in properties) {
    let isEditable = true
    if (uiSchema[key]) {
      if (uiSchema[key]['ui:widget'] === 'hidden') {
        continue
      }
      if (uiSchema[key]['ui:readonly']) {
        isEditable = false
      }
    }
    let { title = key, description = '', type } = properties[key]
    description = description || title
    const { width } = calculateSize(title, {
      font: 'Arial',
      fontSize: '14px',
    })
    type = type === 'integer' ? 'number' : type
    columns.push({
      field: key,
      headerName: title,
      description,
      width: width + 82,
      type,
      isEditable,
      valueGetter,
    })
  }
  return columns
}
export default CollectionList

import { LicenseInfo } from '@mui/x-license-pro'
LicenseInfo.setLicenseKey(
  '61628ce74db2c1b62783a6d438593bc5Tz1NVUktRG9jLEU9MTY4MzQ0NzgyMTI4NCxTPXByZW1pdW0sTE09c3Vic2NyaXB0aW9uLEtWPTI='
)
