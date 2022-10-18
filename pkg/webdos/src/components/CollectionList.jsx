import React, { useRef, useState } from 'react'
import PropTypes from 'prop-types'
import calculateSize from 'calculate-size'
import { DataGridPremium } from '@mui/x-data-grid-premium'
import assert from 'assert-fast'
import Debug from 'debug'
import { useBlockchain, useBlockstream, useChildren, useRouter } from '../hooks'
import { Fab } from '@mui/material'
import { Add } from '@mui/icons-material'
import equal from 'fast-deep-equal'
import process from 'process'

const debug = Debug('terminal:widgets:CollectionList')
const CollectionList = () => {
  const { matchedPath, pulse } = useRouter()
  assert(pulse, 'pulse not loaded')
  assert.strictEqual(pulse.getCovenantPath(), '/system:/collection')
  const { engine } = useBlockchain()
  const [isAdding, setIsAdding] = useState(false)

  const onAddCustomer = async () => {
    debug(`addCustomer `)
    // TODO show an enquiring modal UI over the top to get the data we need
    assert(!isAdding)
    setIsAdding(true)

    const { add } = await engine.actions(matchedPath)
    // use the toSchema functions to interogate the thing
    const result = await add({ formData: { custNo: 1234, name: 'bob' } })
    debug(`add result: `, result)
    // TODO cd into the new customer immediately
    // const newCustomer = await isPending
    // const cd = `cd /crm/customers/bob`
    setIsAdding(false)
  }

  const generateColumns = (datumTemplate) => {
    debug(`generating columns`, datumTemplate)
    const columns = []
    if (!datumTemplate.schema) {
      return columns
    }
    // TODO get nested children columns out, hiding all but top level
    const { properties } = datumTemplate.schema
    const { namePath } = datumTemplate
    for (const key in properties) {
      let { title = key, description = '' } = properties[key]
      description = description || title
      const renderCell = (params) => {
        const { row, field } = params
        const { child } = row
        // TODO need to unmap the field to the nested child
        // need to cache all the blocks so fetching them is very cheap
        // fetch block relating to this child, to get out data
        // show loading screen in meantime
        const childPath = matchedPath + '/' + child
        return (
          <CellBlock
            path={childPath}
            field={field}
            alias={child}
            namePath={namePath[0]}
          />
        )
      }
      const { width } = calculateSize(title, {
        font: 'Arial',
        fontSize: '14px',
      })
      columns.push({
        field: key,
        headerName: title,
        description,
        renderCell,
        width: width + 82,
      })
    }
    return columns
  }
  const state = pulse.getState().toJS()
  const [datumTemplate, setDatumTemplate] = useState({})
  const [columns, setColumns] = useState([])

  debug({ state, datumTemplate, columns })

  if (!equal(datumTemplate, state.datumTemplate)) {
    setDatumTemplate(state.datumTemplate)
    setColumns(generateColumns(state.datumTemplate))
  }

  const listItems = useChildren(matchedPath)
  debug('children', listItems)
  const rows = []
  for (const child of Object.keys(listItems)) {
    rows.push({ id: rows.length, child })
  }
  const onRowClick = ({ row }) => {
    const { child } = row
    debug(`onclick`, child, matchedPath)
    const nextPath = matchedPath + '/' + child
    engine.cd(nextPath)
  }

  return (
    <div style={hideMapBackgrond}>
      <DataGridPremium
        columns={columns}
        rows={rows}
        // autoHeight
        disableMultipleSelection
        hideFooter
        onRowClick={onRowClick}
        loading={isAdding}
      />
      <Fab
        color="primary"
        style={addButtonStyle}
        onClick={onAddCustomer}
        disabled={!isAdding}
      >
        <Add />
      </Fab>
    </div>
  )
}
// CollectionList.propTypes = { children: PropTypes.node }
const CellBlock = ({ path, field, alias, namePath }) => {
  debug('CellBlock', { path, field, alias, namePath })
  const pulse = useBlockstream(path)
  let text
  if (field === namePath) {
    text = alias
  } else if (pulse) {
    const state = pulse.getState().toJS()
    if (state.formData) {
      text = state.formData[field]
    }
    // TODO check if this is a datum
    // TODO draw the columns based on the schema, with local prefs stored for the user
    // TODO draw the different types of object, like checkboxes and others
  }
  // TODO detect the default key, and display this if nothing else showing
  return <div>{text}</div>
}
CellBlock.propTypes = {
  path: PropTypes.string,
  field: PropTypes.string,
  alias: PropTypes.string,
  namePath: PropTypes.string,
}
const addButtonStyle = {
  margin: 0,
  top: 'auto',
  right: 20,
  bottom: 20,
  left: 'auto',
  position: 'fixed',
}
const hideMapBackgrond = {
  position: 'absolute', // hits top of the map background container
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  background: 'white',
}

export default CollectionList
