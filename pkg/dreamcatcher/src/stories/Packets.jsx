import React, { useState, useMemo } from 'react'
import { Crisp } from '@dreamcatcher-tech/webdos'
import List from './List'
import PropTypes from 'prop-types'
import Fab from './Fab'
import Packet from './Packet'
import { packets } from './columns'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'

export const Packets = ({ crisp, onCreate }) => {
  let packet = useMemo(() => {
    const selected = crisp.getSelectedChild()
    if (selected) {
      return crisp.tryGetChild(selected)
    }
  }, [crisp])
  const isLoading = crisp.isLoading || !onCreate
  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        position: 'relative', // for Fab positioning
      }}
    >
      <List crisp={crisp} columns={packets} />
      <Fab type="create" disabled={isLoading} onClick={onCreate} />
      <Packet crisp={packet} />
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
