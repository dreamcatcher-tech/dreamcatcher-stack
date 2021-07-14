import React from 'react'
import Debug from 'debug'
import Explorer from './Explorer'
import { getNextPath } from '../utils'
import OpenDialog from './OpenDialog'
import Datum from './Datum'
import { useRouter } from '../hooks'

const debug = Debug('terminal:widgets:Customer')
debug(`loaded`)
const DialogDatum = () => {
  const { blocks, match, cwd } = useRouter()
  let title = ''
  let name = ''
  let custNo = ''
  const [block1, block] = blocks
  // TODO I am so sorry that I did not do any route scoping
  // TODO make a datum container that can be placed anywhere
  // datums need to display children too, so making a container allows blocks to be passed down ?
  // or make the datums aware by passing down their alias, and they fetch the blocks themselves
  // TODO handle a collection being passed ?
  if (!block || !block.state.schema || !block.state.formData) {
    debug(`not enough info to render`)
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

export default DialogDatum
