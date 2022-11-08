import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import calculateSize from 'calculate-size'
import { api } from '@dreamcatcher-tech/interblock'
import { DataGridPremium } from '@mui/x-data-grid-premium'
import assert from 'assert-fast'
import Debug from 'debug'
import { Fab } from '@mui/material'
import { Add } from '@mui/icons-material'

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
    return complex.network.map((child) => ({
      ...child.state.formData,
      id: child.path,
    }))
  }, [complex.network])
  return (
    <>
      <DataGridPremium
        columns={columns}
        rows={rows}
        autoHeight
        disableMultipleSelection
        hideFooter
        onRowClick={onRow}
        loading={isAdding || isLoading}
      />
      <Fab
        color="primary"
        style={addButtonStyle}
        onClick={onAddCustomer}
        disabled={isAdding}
      >
        <Add />
      </Fab>
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
