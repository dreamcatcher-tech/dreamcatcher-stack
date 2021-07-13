import React from 'react'
import Debug from 'debug'
import Explorer from './Explorer'
import { getNextPath } from '../utils'
import OpenDialog from './OpenDialog'
import Datum from './Datum'
const debug = Debug('terminal:widgets:Customer')
debug(`loaded`)
const Customer = (props) => {
  const { blocks, match, cwd } = props
  let title = ''
  let name = ''
  let custNo = ''
  const [first, second, block] = blocks
  // TODO I am so sorry that I did not do any route scoping
  if (!block || !block.state.schema || !block.state.formData) {
    return null
  }
  title = block.state.schema.title
  name = block.state.formData.name || block.state.formData.to
  // TODO get the identifier key out

  return (
    <>
      <OpenDialog title={`${title}: ${name}`}>
        <Datum block={block} />
      </OpenDialog>
    </>
  )
}

export default Customer
