import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import calculateSize from 'calculate-size'
import { api } from '@dreamcatcher-tech/interblock'
import { DataGridPremium } from '@mui/x-data-grid-premium/DataGridPremium'
import assert from 'assert-fast'
import Debug from 'debug'
import Fab from '@mui/material/Fab'
import Add from '@mui/icons-material/Add'

const debug = Debug('terminal:widgets:CollectionList')

const CollectionList = ({ onAdd, onRow, complex }) => {
  const [isAdding, setIsAdding] = useState(false)

  const onAddCustomer = () => {
    debug(`addCustomer `)
    // TODO show an enquiring modal UI over the top to get the data we need
    assert(!isAdding)
    setIsAdding(true)
    onAdd({ formData: { custNo: 1234, name: 'bob' } }).then(() => {
      setIsAdding(false)
    })
  }
  const { template } = complex.state
  const { isLoading } = complex
  const columns = useMemo(() => generateColumns(template), [template])
  const rows = useMemo(() => {
    debug('generating rows')
    const rows = complex.network.map((child) => ({
      ...child.state.formData,
      id: child.path,
    }))
    debug('rows generated')
    return rows
  }, [complex.network])
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
  return (
    <>
      <DataGridPremium
        backgroundColor="paper"
        columns={columns}
        rows={rows}
        autoHeight
        disableMultipleSelection
        hideFooter
        onRowClick={onRow}
        loading={isAdding || isLoading}
      />
      {onAdd ? fab : null}
    </>
  )
}
CollectionList.propTypes = {
  onAdd: PropTypes.func,
  onRow: PropTypes.func,
  complex: PropTypes.instanceOf(api.Complex).isRequired,
}

const addButtonStyle = {
  margin: 0,
  top: 'auto',
  right: 20,
  bottom: 20,
  left: 'auto',
  position: 'fixed',
}

const generateColumns = (template) => {
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
    columns.push({
      field: key,
      headerName: title,
      description,
      width: width + 82,
      type,
      isEditable,
    })
  }
  return columns
}
export default CollectionList

import { LicenseInfo } from '@mui/x-license-pro'
LicenseInfo.setLicenseKey(
  '61628ce74db2c1b62783a6d438593bc5Tz1NVUktRG9jLEU9MTY4MzQ0NzgyMTI4NCxTPXByZW1pdW0sTE09c3Vic2NyaXB0aW9uLEtWPTI='
)
