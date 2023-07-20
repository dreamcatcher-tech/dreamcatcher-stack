import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import calculateSize from 'calculate-size'
import { Crisp } from '@dreamcatcher-tech/interblock'
import { DataGridPro } from '@mui/x-data-grid-pro/DataGridPro'
import assert from 'assert-fast'
import Debug from 'debug'

const debug = Debug('terminal:widgets:InnerCollection')

const InnerCollection = ({ onAdd, onRow, crisp, template }) => {
  assert(template, `template is required`)

  const { state } = crisp
  const { formData = {} } = state
  const { rows = [] } = formData
  const { uiSchema } = template
  const { isLoading } = crisp
  const rowSchema = template.schema.properties.rows.items
  const columns = useMemo(
    () => generateColumns(rowSchema, uiSchema),
    [template]
  )
  return (
    <>
      <DataGridPro
        columns={columns}
        rows={rows}
        disableMultipleRowSelection
        hideFooter
        onRowClick={onRow}
        loading={isLoading}
      />
    </>
  )
}
InnerCollection.propTypes = {
  onAdd: PropTypes.func,
  onRow: PropTypes.func,
  crisp: PropTypes.instanceOf(Crisp),
  template: PropTypes.object.isRequired,
}

const generateColumns = (schema, uiSchema = {}) => {
  debug(`generating columns`)
  const columns = []
  if (!schema) {
    return columns
  }
  // TODO get nested children columns out, hiding all but top level
  const { properties } = schema
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
export default InnerCollection

import { LicenseInfo } from '@mui/x-license-pro'
LicenseInfo.setLicenseKey(
  '94a2a6180c0f4f3fe01a37fea6c43795Tz02NjAyMyxFPTE3MTUyMTY5Njk1NDEsUz1wcm8sTE09c3Vic2NyaXB0aW9uLEtWPTI='
)
