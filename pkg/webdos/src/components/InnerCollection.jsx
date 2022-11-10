import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import calculateSize from 'calculate-size'
import { api } from '@dreamcatcher-tech/interblock'
import { DataGridPremium } from '@mui/x-data-grid-premium'
import assert from 'assert-fast'
import Debug from 'debug'

const debug = Debug('terminal:widgets:InnerCollection')

const InnerCollection = ({ onAdd, onRow, complex }) => {
  const { formData } = complex.state
  let { template } = complex.state
  if (template === '..') {
    template = complex.parent().state.template
  }
  assert(template, `template is required`)
  const { type, uiSchema } = template
  assert.strictEqual(type, 'INNER_COLLECTION', `template.type: ${type}`)
  const { isLoading } = complex
  const rowSchema = template.schema.properties.rows.items
  const columns = useMemo(
    () => generateColumns(rowSchema, uiSchema),
    [template]
  )
  const { rows } = formData
  return (
    <>
      <DataGridPremium
        columns={columns}
        rows={rows}
        autoHeight
        disableMultipleSelection
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
  complex: PropTypes.instanceOf(api.Complex).isRequired,
}

const generateColumns = (schema, uiSchema = {}) => {
  debug(`generating columns`, schema, uiSchema)
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
  '61628ce74db2c1b62783a6d438593bc5Tz1NVUktRG9jLEU9MTY4MzQ0NzgyMTI4NCxTPXByZW1pdW0sTE09c3Vic2NyaXB0aW9uLEtWPTI='
)
