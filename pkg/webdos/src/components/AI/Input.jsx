import { AudioRecorder } from 'react-audio-voice-recorder'
import { LiveAudioVisualizer } from 'react-audio-visualize'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import MicIcon from '@mui/icons-material/Mic'
import Attach from '@mui/icons-material/AttachFile'
import SendIcon from '@mui/icons-material/ArrowUpwardRounded'

const debug = Debug('AI:ThreeBox')
debug(`loaded`)

const Send = ({ crisp }) => (
  <IconButton>
    <SendIcon />
  </IconButton>
)

const Mic = ({ crisp, setMic }) => (
  <IconButton
    onTouchStart={() => setMic(true)}
    onTouchEnd={() => setMic(false)}
    onMouseDown={() => setMic(true)}
    onMouseUp={() => setMic(false)}
  >
    <MicIcon />
  </IconButton>
)

const Input = ({ crisp }) => {
  const [value, setValue] = React.useState('')
  const [mic, setMic] = React.useState(false)
  console.log('mic', mic)
  return (
    <TextField
      value={value}
      multiline
      fullWidth
      variant="outlined"
      label="Input"
      // margin="normal"
      placeholder="Message DreamcatcherGPT..."
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Attach fontSize="medium" />
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end">
            {value ? (
              <Send crisp={crisp} />
            ) : (
              <Mic crisp={crisp} setMic={setMic} />
            )}
          </InputAdornment>
        ),
      }}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}
Input.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default Input
