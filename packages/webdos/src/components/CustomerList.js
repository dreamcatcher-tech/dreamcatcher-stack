import React, { useRef } from 'react'
import calculateSize from 'calculate-size'
import { XGrid } from '@material-ui/x-grid'
import assert from 'assert'
import Debug from 'debug'
import { useBlockchain, useBlockstream } from '../hooks'
import { Fab } from '@material-ui/core'
import { Add } from '@material-ui/icons'

const debug = Debug('terminal:widgets:CustomerList')
const CustomerList = (props) => {
  const { blocks, match, cwd } = props // TODO verify this is a Collection
  const { blockchain, isPending } = useBlockchain()
  // TODO disable '+' button if we are not the cwd
  const isCwd = true
  const columnsRef = useRef()
  const [block] = blocks

  const onAddCustomer = async () => {
    assert(!isPending, `Cannot add customers simultaneously`)
    debug(`addCustomer `)
    // show an enquiring modal UI over the top to get the data we need

    const command = `./add --isTestData\n`
    for (const c of command) {
      // process.stdin.send(c)
    }
    const { add } = await blockchain.getActionCreators(match)
    const addAction = add({ isTestData: true })
    const result = await blockchain.dispatch(addAction, match)
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

  const columns = columnsRef.current || []
  const rows = []
  if (block && block.state.datumTemplate && !columnsRef.current) {
    const { datumTemplate } = block.state
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
  }
  const children = _getChildren(block)
  for (const child of children) {
    rows.push({ id: rows.length, child })
  }
  const onClick = ({ id }) => {
    const child = children[id]
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

  return (
    <div style={{ flex: 1, background: 'white' }}>
      <XGrid
        columns={columns}
        rows={rows}
        loading={!block}
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
        disabled={isPending || !isCwd}
      >
        <Add />
      </Fab>
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

export default CustomerList
