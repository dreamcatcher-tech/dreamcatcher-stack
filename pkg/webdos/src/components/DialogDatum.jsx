import React from 'react'
import Debug from 'debug'
import Explorer from './Explorer'
import { getNextPath } from '../utils'
import OpenDialog from './OpenDialog'
import Datum from './Datum'
import { useRouter } from '../hooks'
import assert from 'assert-fast'

const debug = Debug('webdos:widgets:DialogDatum')
debug(`loaded`)
const DialogDatum = () => {
  const { matchedPath, pulse } = useRouter()
  debug('matchedPath', matchedPath)
  let title = ''
  let name = ''
  let custNo = ''
  // TODO make a datum container that can be placed anywhere
  // datums need to display children too, so making a container allows blocks to be passed down ?
  // or make the datums aware by passing down their alias, and they fetch the blocks themselves
  // or use routes as children, so can use no special methods

  // TODO handle a collection being passed ?
  assert(pulse)
  const state = pulse.getState().toJS()
  title = state.schema.title
  name = state.formData.name
  // TODO regen the identifier

  return (
    <>
      <OpenDialog title={`${title}: ${name}`}>
        <Datum pulse={pulse} />
      </OpenDialog>
    </>
  )
}

export default DialogDatum
