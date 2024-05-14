import Input from './Input'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import { Crisp } from '@dreamcatcher-tech/interblock'
import { StateBoard } from './StateBoard'
import React, { useState, useCallback, useEffect } from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import Messages from './Messages'

const debug = Debug('AI:ThreeBox')

const ThreeBox = ({ crisp, preload, preSubmit }) => {
  if (crisp.absolutePath !== '/') {
    throw new Error(`${crisp.absolutePath} !== '/'`)
  }
  const [hal, setHal] = useState()
  const [error, setError] = useState()
  if (error) {
    throw error
  }
  useEffect(() => {
    setTimeout(() => {
      window.scrollTo(0, document.body.scrollHeight)
    }, 100)
  }, [hal])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const onTranscription = useCallback((isTranscribing) => {
    setIsTranscribing(isTranscribing)
  })
  const onSend = useCallback(
    (value) => hal.ownActions.prompt(value).catch(setError),
    [hal]
  )
  useEffect(() => {
    if (!crisp || crisp.isLoadingChildren || !crisp.hasChild('.HAL')) {
      return
    }
    const next = crisp.getChild('.HAL')
    if (next !== hal) {
      debug('setHal', next)
      setHal(next)
    }
  }, [crisp])
  if (!hal || hal.isLoadingActions) {
    return
  }
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        width: '100%',
      }}
    >
      <Stack
        direction="column"
        alignItems="flex-start"
        justifyContent="flex-end"
        pb={3}
        pr={1}
        sx={{ minHeight: '100%', maxWidth: '500px' }}
      >
        <Messages crisp={hal} isTranscribing={isTranscribing} />
        <Input
          onSend={onSend}
          preload={preload}
          preSubmit={preSubmit}
          onTranscription={onTranscription}
        />
      </Stack>
      <Box sx={{ flexGrow: 1, p: 1 }}>
        <Paper elevation={6} sx={{ height: '100%', flexGrow: 1 }}>
          <StateBoard crisp={crisp} />
        </Paper>
      </Box>
    </Box>
  )
}
ThreeBox.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  preload: PropTypes.string,
  preSubmit: PropTypes.bool,
}

export default ThreeBox
