import { AudioRecorder, useAudioRecorder } from 'react-audio-voice-recorder'
import { LiveAudioVisualizer } from 'react-audio-visualize'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import MicIcon from '@mui/icons-material/Mic'
import Attach from '@mui/icons-material/AttachFile'
import SendIcon from '@mui/icons-material/ArrowUpwardRounded'
import OpenAI, { toFile } from 'openai'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
})

const debug = Debug('AI:Input')

const Send = ({ crisp }) => (
  <IconButton>
    <SendIcon />
  </IconButton>
)

const Mic = ({ crisp, start, stop }) => (
  <IconButton
    onTouchStart={start}
    onTouchEnd={stop}
    onMouseDown={start}
    onMouseUp={stop}
  >
    <MicIcon />
  </IconButton>
)

const Input = ({ crisp }) => {
  const [value, setValue] = React.useState('')
  const {
    startRecording,
    stopRecording,
    recordingBlob,
    isRecording,
    mediaRecorder,
  } = useAudioRecorder()
  useEffect(() => {
    if (recordingBlob) {
      const file = new File([recordingBlob], 'recording.webm', {
        type: recordingBlob.type,
      })
      openai.audio.transcriptions
        .create({ file, model: 'whisper-1' })
        .then((transcription) => {
          setValue(transcription.text)
        })
    }
  }, [recordingBlob])

  const inputProps = {
    endAdornment: (
      <InputAdornment position="end">
        {value ? (
          <Send crisp={crisp} />
        ) : (
          <>
            {isRecording && (
              <LiveAudioVisualizer
                height={35}
                width={310}
                mediaRecorder={mediaRecorder}
              />
            )}
            <Mic crisp={crisp} start={startRecording} stop={stopRecording} />
          </>
        )}
      </InputAdornment>
    ),
  }
  if (!isRecording) {
    inputProps.startAdornment = (
      <InputAdornment position="start">
        <Attach fontSize="medium" />
      </InputAdornment>
    )
  }

  return (
    <TextField
      value={isRecording ? ' ' : value}
      multiline
      fullWidth
      variant="outlined"
      label="Input"
      placeholder={isRecording ? null : 'Message DreamcatcherGPT...'}
      InputProps={inputProps}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}
Input.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default Input
