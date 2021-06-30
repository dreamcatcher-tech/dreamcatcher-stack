import React from 'react'
import Debug from 'debug'
import Explorer from './Explorer'
import { getNextPath } from '../utils'
import OpenDialog from './OpenDialog'
import Datum from './Datum'
const debug = Debug('terminal:widgets:Customer')
debug(`loaded`)
const Customer = (props) => {
  const { block, path, cwd } = props
  const nextPath = getNextPath(path, cwd)
  const nextProps = { ...props, cwd: nextPath }
  const child = nextPath ? <Explorer {...nextProps} /> : null
  // TODO assert that this is a datum, and that it is formatted correctly ?

  const { title } = block.state.schema
  const { custNo, name } = block.state.formData

  return (
    <>
      <OpenDialog title={`${title}: ${name} (${custNo})`}>
        <Datum block={block} />
      </OpenDialog>
      {child}
    </>
  )
}

export default Customer
