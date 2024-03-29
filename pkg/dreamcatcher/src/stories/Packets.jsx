import React, { useState, useMemo } from 'react'
import { Crisp } from '@dreamcatcher-tech/webdos'
import List from './List'
import PropTypes from 'prop-types'
import Fab from './Fab'
import Packet from './Packet'
import { packets } from './columns'
import Box from '@mui/material/Box'

export const Packets = ({ crisp, onCreate }) => {
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
      <List crisp={crisp} columns={packets} />
      <Fab type="create" disabled={!onCreate} onClick={onCreate} />
      <Packet crisp={selected} />
    </Box>
  )
}
Packets.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  /**
   * Will cd into Drafts and create a new draft.
   */
  onCreate: PropTypes.func,
}
