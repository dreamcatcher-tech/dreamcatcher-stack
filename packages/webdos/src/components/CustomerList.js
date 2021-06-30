import React, { useRef } from 'react'
import calculateSize from 'calculate-size'
import { XGrid } from '@material-ui/x-grid'
import assert from 'assert'
import Debug from 'debug'
import Explorer from './Explorer'
import { getNextPath } from '../utils'
import {
  useBlockchain,
  useBlockstream,
} from '@dreamcatcher-tech/web-components'
import { Fab } from '@material-ui/core'
import { Add } from '@material-ui/icons'

const debug = Debug('terminal:widgets:CustomerList')
const CustomerList = (props) => {
  const { block, path, cwd } = props // TODO verify this is a Collection
  const { isPending } = useBlockchain()
  const columnsRef = useRef()
  const nextPath = getNextPath(path, cwd)
  const nextProps = { ...props, cwd: nextPath }
  const child = nextPath ? <Explorer {...nextProps} /> : null

  const onAddCustomer = async () => {
    assert(!isPending, `Cannot add customers simultaneously`)
    debug(`addCustomer`)
    // show an enquiring modal UI over the top to get the data we need

    const command = `./add --isTestData\n`
    for (const c of command) {
      process.stdin.send(c)
    }
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

  const { datumTemplate } = block.state
  const columns = columnsRef.current || []
  const rows = []
  if (datumTemplate && !columnsRef.current) {
    columnsRef.current = columns
    // TODO get nested children columns out, hiding all but top level
    const { properties } = datumTemplate.schema
    const { namePath } = datumTemplate
    for (const key in properties) {
      let { title = key, description = '' } = properties[key]
      description = description || title
      const renderCell = (params) => {
        const { row, field } = params
        const { child } = row
        // need to unmap the field to the nested child
        // need to cache all the blocks so fetching them is very cheap
        // fetch block relating to this child, to get out data
        // show loading screen in meantime
        const childPath = cwd + '/' + child
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
        width: width + 60,
      })
    }
  }
  const children = _getChildren(block)
  if (children.length === 2) {
    // debugger
  }
  for (const child of children) {
    rows.push({ id: rows.length, child })
  }
  const onClick = ({ id }) => {
    const child = children[id]
    debug(`onclick`, child, cwd)
    const nextPath = cwd + '/' + child
    if (path === nextPath) {
      debug(`no change to ${path}`)
      return
    }
    const command = `cd ${nextPath}\n`
    for (const c of command) {
      process.stdin.send(c)
    }
  }

  return (
    <div style={{ flex: '1' }}>
      <XGrid
        columns={columns}
        rows={rows}
        loading={!datumTemplate}
        disableMultipleSelection
        onRowClick={onClick}
        hideFooter
        autoHeight
        logLevel="warn" // does not work
      />
      <Fab
        color="primary"
        style={addButtonStyle}
        onClick={onAddCustomer}
        disabled={isPending}
      >
        <Add />
      </Fab>
      {child}
    </div>
  )
}
const _getChildren = (block) => {
  const masked = ['..', '.', '.@@io']
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

export default CustomerList
