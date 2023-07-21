import { useMemo } from 'react'
import { Crisp } from '@dreamcatcher-tech/webdos'
import List from './List'
import PropTypes from 'prop-types'
import Fab from './Fab'
import { changes } from './columns'
import Box from '@mui/material/Box'
import DraftHeader from './DraftHeader'

export const Changes = ({ crisp, onCreate }) => {
  let selected = useMemo(() => {
    const selected = crisp.getSelectedChild()
    if (selected) {
      return crisp.tryGetChild(selected)
    }
  }, [crisp])
  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        position: 'relative', // for Fab positioning
      }}
    >
      <List crisp={crisp} columns={changes} />
      <Fab type="create" disabled={!onCreate} onClick={onCreate} />
      <DraftHeader crisp={selected} />
    </Box>
  )
}
Changes.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  /**
   * Will cd into Drafts and create a new draft.
   */
  onCreate: PropTypes.func,
}
