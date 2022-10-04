import React, { useRef, useState, useEffect } from 'react'
import calculateSize from 'calculate-size'
import { XGrid } from '@material-ui/x-grid'
import assert from 'assert-fast'
import Debug from 'debug'
import { useBlockchain, useBlockstream, useRouter } from '../hooks'
import { Fab } from '@material-ui/core'
import { Add } from '@material-ui/icons'
import equal from 'fast-deep-equal'
import process from 'process'

const debug = Debug('terminal:widgets:CollectionList')
const CollectionList = (props) => {
  const { children } = props // TODO verify this is a Collection
  const { blocks, match, cwd } = useRouter()

  const { blockchain, isPending } = useBlockchain()
  // TODO disable '+' button if we are not the cwd
  const isCwd = true
  const [block] = blocks

  const onAddCustomer = async () => {
    assert(!isPending, `Cannot add customers simultaneously`)
    debug(`addCustomer `)
    // show an enquiring modal UI over the top to get the data we need

    const command = `./add --isTestData\n`
    for (const c of command) {
      // process.stdin.send(c)
    }
    const { add } = await blockchain.actions(match)
    const result = await add({ isTestData: true })
    debug(`add result: `, result)
    // const newCustomer = await isPending
    // how to learn what customer just got added ?
    // const cd = `cd /crm/customers/bob`
  }
  const addButtonStyle = {
    margin: 0,
    top: 'auto',
    right: 20,
    bottom: 20,
    left: 'auto',
    position: 'fixed',
  }
  const regenerateColumns = (datumTemplate) => {
    debug(`generating new columns`)
    const columns = []
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
        const childPath = match + '/' + child
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
  const ref = useRef({ columns: [], datumTemplate: {} })
  if (block && block.state.datumTemplate) {
    const { datumTemplate } = block.state
    if (datumTemplate) {
      if (!equal(ref.current.datumTemplate, datumTemplate)) {
        debug(`updating datumTemplate`)
        ref.current.datumTemplate = datumTemplate
        ref.current.columns = regenerateColumns(datumTemplate)
      }
    }
  }

  const listItems = _getChildren(block)
  const rows = []
  for (const child of listItems) {
    rows.push({ id: rows.length, child })
  }
  const onRowClick = ({ id }) => {
    const child = listItems[id]
    debug(`onclick`, child, match, cwd)
    const nextPath = match + '/' + child
    if (match === nextPath) {
      debug(`no change to ${match}`)
      return
    }
    const command = `cd ${nextPath}\n`
    for (const c of command) {
      // TODO replace with NavLink
      process.stdin.send(c)
    }
  }
  const hideMapBackgrond = {
    position: 'absolute', // hits top of the map background container
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    background: 'white',
  }

  return (
    <div style={hideMapBackgrond}>
      <XGrid
        columns={ref.current.columns}
        rows={rows}
        // autoHeight
        disableMultipleSelection
        hideFooter
        loading={!block}
        onRowClick={onRowClick}
      />
      <Fab
        color="primary"
        style={addButtonStyle}
        onClick={onAddCustomer}
        disabled={isPending || !isCwd}
      >
        <Add />
      </Fab>
      {children}
    </div>
  )
}
const _getChildren = (block) => {
  const masked = ['..', '.', '.@@io']
  if (!block) {
    return []
  }
  return block.network
    .getAliases()
    .filter((alias) => !masked.includes(alias) && !alias.startsWith('.'))
}
const CellBlock = ({ path, field, alias, namePath }) => {
  const block = useBlockstream(path)
  let text
  if (field === namePath) {
    text = alias
  } else if (block && block.state.formData) {
    // TODO check if this is a datum
    // TODO draw the columns based on the schema, with local prefs stored for the user
    // TODO draw the different types of object, like checkboxes and others
    const { state } = block
    text = state.formData[field]
  }
  // TODO detect the default key, and display this if nothing else showing
  return <div>{text}</div>
}

export default CollectionList
