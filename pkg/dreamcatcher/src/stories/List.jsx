import { useMemo, useState, useRef, useEffect, useId } from 'react'
import PropTypes from 'prop-types'
import { Crisp } from '@dreamcatcher-tech/webdos'
import { DataGridPro } from '@mui/x-data-grid-pro/DataGridPro'
import assert from 'assert-fast'
import Debug from 'debug'
import posix from 'path-browserify'

const debug = Debug('dreamcatcher:List')

// TODO lazy load with skeletons https://mui.com/x/react-data-grid/row-updates/

// use the rows direct out of the crisp, which uses caching and keeps the same
// reference if nothing changed: <DataGrid getRowId={(row) => row.internalId} />
// means that we can map the id on the fly.
// then the valuegetter can just dig into the crisp, rather than making copies

const List = ({ crisp, columns }) => {
  const columnHeaders = useMemo(() => {
    if (crisp.isLoading) {
      return []
    }
    return generateColumns(crisp, columns)
  }, [crisp, columns])

  const rows = useMemo(() => {
    // TODO cache based on the sortedChildren map, not crisp
    if (crisp.isLoadingChildren) {
      return []
    }
    return crisp.sortedChildren.map((id) => ({ id }))
  }, [crisp])

  const onRow = ({ id }) => {
    debug('onRow', id)
    const current = posix.resolve(crisp.path, id)
    if (!crisp.wd.startsWith(current)) {
      const path = crisp.absolutePath + '/' + id
      const allowVirtual = true
      crisp.actions.cd(path, allowVirtual)
    }
  }

  return (
    <>
      <DataGridPro
        sx={{ height: '100%', width: '100%' }}
        backgroundColor="paper"
        columns={columnHeaders}
        rows={rows}
        disableMultipleRowSelection
        hideFooter
        onRowClick={onRow}
        loading={crisp.isLoadingChildren}
      />
    </>
  )
}
List.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  columns: PropTypes.arrayOf(PropTypes.object),
}

const generateColumns = (crisp, columns = []) => {
  assert(crisp instanceof Crisp, 'crisp must be a Crisp')
  assert(!crisp.isLoading)
  const columnHeaders = []
  const { template } = crisp.state
  assert(template.schema, 'template must have a schema')
  const { properties } = template.schema
  const { uiSchema = {} } = template
  const columnPropsStack = [...columns]
  for (const key in properties) {
    if (uiSchema[key]) {
      if (uiSchema[key]['ui:widget'] === 'hidden') {
        continue
      }
    }
    let { title = key, description = '', type } = properties[key]
    description = description || title
    if (type === 'integer') {
      type = 'number'
    } else if (type !== 'boolean') {
      type = 'string'
    }
    /**
     * Native types:
      'string' (default)
      'number'
      'date'
      'dateTime'
      'boolean'
      'singleSelect'
      'actions'
     */
    const props = columnPropsStack.shift()
    columnHeaders.push({
      field: key,
      headerName: title,
      description,
      type,
      valueGetter: ({ id, field }) => {
        const child = crisp.getChild(id)
        if (child.isLoading) {
          return
        }
        return child.state.formData[field]
      },
      ...props,
    })
  }
  return columnHeaders
}
export default List

import { LicenseInfo } from '@mui/x-license-pro'
LicenseInfo.setLicenseKey(
  '94a2a6180c0f4f3fe01a37fea6c43795Tz02NjAyMyxFPTE3MTUyMTY5Njk1NDEsUz1wcm8sTE09c3Vic2NyaXB0aW9uLEtWPTI='
)
