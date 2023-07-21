import { useMemo } from 'react'
import { Crisp } from '@dreamcatcher-tech/webdos'
import List from './List'
import PropTypes from 'prop-types'
import Fab from './Fab'
import { drafts } from './columns'
import Box from '@mui/material/Box'
import DraftHeader from './DraftHeader'
import Debug from 'debug'
const debug = Debug('dreamcatcher:Drafts')

export const Drafts = ({ crisp, onCreate }) => {
  let selected = useMemo(() => {
    const selected = crisp.getSelectedChild()
    if (selected) {
      return crisp.tryGetChild(selected)
    }
  }, [crisp])
  return (
    // for Fab positioning
    <Box sx={{ height: '100%', width: '100%', position: 'relative' }}>
      <List crisp={crisp} columns={drafts} />
      <Fab type="create" disabled={!onCreate} onClick={onCreate} />
      <DraftHeader crisp={selected} />
    </Box>
  )
}

Drafts.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  /**
   * Will cd into Drafts and create a new draft.
   */
  onCreate: PropTypes.func,
}
