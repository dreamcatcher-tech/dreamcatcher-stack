import Input from './Input'
import Stack from '@mui/material/Stack'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React, { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Messages from './Messages'

const debug = Debug('AI:ThreeBox')
debug(`loaded`)

let key = 0

const ThreeBox = ({ crisp }) => {
  if (!crisp || crisp.isLoading) {
    return
  }
  if (crisp.absolutePath !== '/.HAL') {
    throw new Error(`${crisp.absolutePath} !== '/.HAL'`)
  }
  const [error, setError] = useState()
  const onSend = useCallback(
    (value) => {
      key++
      return crisp.ownActions.user(value, key + '').catch(setError)
    },
    [crisp]
  )
  if (error) {
    throw error
  }
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        width: '100%',
        // background: 'purple',
      }}
    >
      <Box
        sx={{
          height: '100%',
          maxWidth: '400px',
          width: '400px',
          minWidth: '400px',
          // backgroundColor: 'lightGray',
          display: 'flex',
        }}
      >
        <Stack
          direction="column"
          alignItems="flex-start"
          justifyContent="flex-end"
          p={1}
          sx={{ width: '100%' }}
        >
          <Messages crisp={crisp} />
          <Input onSend={onSend} />
        </Stack>
      </Box>
      <Box sx={{ flexGrow: 1, p: 1 }}>
        <Paper elevation={6} sx={{ height: '100%', flexGrow: 1 }}></Paper>
      </Box>
    </Box>
  )
}
ThreeBox.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default ThreeBox
