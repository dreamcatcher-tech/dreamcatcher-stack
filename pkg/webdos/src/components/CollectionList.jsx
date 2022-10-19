import React, { useMemo, useState } from 'react'
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

const Data = () => {
  const { matchedPath, pulse } = useRouter()
  assert(pulse, 'pulse not loaded')
  assert.strictEqual(pulse.getCovenantPath(), '/system:/collection')
  const { engine } = useBlockchain()
  const onAdd = async (data) => {
    const { add } = await engine.actions(matchedPath)
    // use the toSchema functions to interogate the thing
    const result = await add(data)
    debug(`add result: `, result)
    // TODO cd into the new customer immediately
    // const newCustomer = await isPending
    // const cd = `cd /crm/customers/bob`
  }
  const state = pulse.getState().toJS()
  const onRow = ({ row }) => {
    const { child } = row
    debug(`onclick`, child, matchedPath)
    const nextPath = matchedPath + '/' + child
    engine.cd(nextPath)
  }
  return <CollectionList {...{ onAdd, onRow }} />
}
/**
 * CollectionList
 */
const CollectionList = ({ onAdd, onRow, template, rows, loading }) => {
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

  const columns = useMemo(() => generateColumns(template), [template])

  const isLoading = isAdding || loading
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
  // { onAdd, onRow, template, rows, fetch, loading }

  /**
   * Add an item using the blockchain engine
   */
  onAdd: PropTypes.func,
  /**
   * Handler for row clicks
   */
  onRow: PropTypes.func,
  /**
   * Datum template
   */
  template: PropTypes.object,
  /**
   * list of row data that is streamed in as the engine
   * fetches it from disk and network and changes.
   */
  rows: PropTypes.arrayOf(PropTypes.object),
  /**
   * Is the engine aware of more data yet to be loaded ?
   */
  loading: PropTypes.bool,
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
  // position: 'absolute', // hits top of the map background container
  // top: 0,
  // left: 0,
  // bottom: 0,
  // right: 0,
  // background: 'white',
  // height: '100%',
  // flex: 1,
}

const generateColumns = (template) => {
  debug(`generating columns`, template)
  const columns = []
  if (!template || !template.schema) {
    return columns
  }
  // TODO get nested children columns out, hiding all but top level
  const { properties } = template.schema
  for (const key in properties) {
    let { title = key, description = '' } = properties[key]
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
    })
  }
  return columns
}
export default CollectionList
