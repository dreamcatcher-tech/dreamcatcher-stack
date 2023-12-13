import Input from './Input'
import Stack from '@mui/material/Stack'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React, { useState, useCallback, useEffect } from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import Messages from './Messages'

const debug = Debug('AI:ThreeBox')
debug(`loaded`)

const ThreeBox = ({ crisp, preload, preSubmit }) => {
  const [error, setError] = useState()
  const onSend = useCallback(
    (value) => {
      return crisp.ownActions.user(value).catch(setError)
    },
    [crisp]
  )
  if (error) {
    throw error
  }
  useEffect(() => {
    setTimeout(() => {
      window.scrollTo(0, document.body.scrollHeight)
    }, 100)
  }, [crisp])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const onTranscription = useCallback((isTranscribing) => {
    setIsTranscribing(isTranscribing)
  })
  if (!crisp || crisp.isLoadingChildren) {
    return
  }
  if (crisp.absolutePath !== '/.HAL') {
    throw new Error(`${crisp.absolutePath} !== '/.HAL'`)
  }
  return (
    <Stack
      direction="column"
      alignItems="flex-start"
      justifyContent="flex-end"
      p={1}
      sx={{ width: '100%', minHeight: '100%' }}
    >
      <Messages crisp={crisp} isTranscribing={isTranscribing} />
      <Input
        onSend={onSend}
        preload={preload}
        preSubmit={preSubmit}
        onTranscription={onTranscription}
      />
    </Stack>
  )
  // return (
  //   <Box
  //     sx={{
  //       display: 'flex',
  //       flexDirection: 'row',
  //       height: '100%',
  //       width: '100%',
  //     }}
  //   >
  //     {/* <Box
  //       sx={{
  //         height: '100%',
  //         maxWidth: '400px',
  //         width: '400px',
  //         minWidth: '400px',
  //         // backgroundColor: 'lightGray',
  //         display: 'flex',
  //       }}
  //     > */}
  //     <Stack
  //       direction="column"
  //       alignItems="flex-start"
  //       justifyContent="flex-end"
  //       p={1}
  //       sx={{ width: '100%' }}
  //     >
  //       <Messages crisp={crisp} />
  //       <Input onSend={onSend} />
  //     </Stack>
  //     {/* </Box> */}
  //     {/* <Box sx={{ flexGrow: 1, p: 1 }}>
  //       <Paper elevation={6} sx={{ height: '100%', flexGrow: 1 }}></Paper>
  //     </Box> */}
  //   </Box>
  // )
}
ThreeBox.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  preload: PropTypes.string,
  preSubmit: PropTypes.bool,
}

export default ThreeBox
