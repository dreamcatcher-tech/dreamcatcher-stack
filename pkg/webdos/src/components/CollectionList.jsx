import React, { useMemo, useState, useRef } from 'react'
import PropTypes from 'prop-types'
import calculateSize from 'calculate-size'
import { Crisp } from '@dreamcatcher-tech/interblock'
import { DataGridPremium } from '@mui/x-data-grid-premium/DataGridPremium'
import assert from 'assert-fast'
import Debug from 'debug'
import Fab from '@mui/material/Fab'
import Add from '@mui/icons-material/Add'

const debug = Debug('terminal:widgets:CollectionList')

const CollectionList = ({ crisp }) => {
  // TODO assert the complex has a collection as its covenant
  debug('crisp', crisp)
  const [isAdding, setIsAdding] = useState(false)
  assert(crisp.isLoading || crisp.covenant === '/system:/collection')

  const crispRef = useRef()
  crispRef.current = crisp

  const onAddCustomer = async () => {
    assert(!isAdding)
    assert(!crisp.isLoadingActions)
    debug(`addCustomer `, crisp)
    // TODO show an enquiring modal UI over the top to get the data we need
    setIsAdding(true)
    const { add } = crisp.actions
    debug(crisp.actions)
    let custNo
    let count = 0
    const current = [...crisp]
    do {
      count++
      if (!current.includes(count + '')) {
        custNo = count
      }
    } while (!custNo)
    await add({ formData: { custNo, name: 'bob' } })
    setIsAdding(false)
  }
  const valueGetter = ({ id, field }) => {
    const child = crisp.getChild(id)
    if (!child.isLoading && child.state.formData) {
      return child.state.formData[field]
    }
    return '...'
  }
  const columns = useMemo(() => {
    if (crisp.isLoading) {
      return []
    }
    return generateColumns(crisp.state.template, valueGetter)
  }, [crisp])
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
  const fab = (
    <Fab
      color="primary"
      style={addButtonStyle}
      onClick={onAddCustomer}
      disabled={isAdding}
    >
      <Add />
    </Fab>
  )
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
        loading={isAdding || crisp.isLoading}
      />
      {onAdd ? fab : null}
    </>
  )
}
CollectionList.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
}

const addButtonStyle = {
  margin: 0,
  top: 'auto',
  right: 20,
  bottom: 20,
  left: 'auto',
  position: 'fixed',
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
