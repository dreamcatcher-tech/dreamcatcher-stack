import { useAudioRecorder } from 'react-audio-voice-recorder'
import { useFilePicker } from 'use-file-picker'
import { LiveAudioVisualizer } from 'react-audio-visualize'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React, { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import MicIcon from '@mui/icons-material/Mic'
import Attach from '@mui/icons-material/AttachFile'
import SendIcon from '@mui/icons-material/ArrowUpwardRounded'
import OpenAI from 'openai'
import process from 'process'
if (!import.meta.env.VITE_OPENAI_API_KEY) {
  throw new Error('VITE_OPENAI_API_KEY is not defined')
}

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
})

const debug = Debug('AI:Input')

const Send = ({ send }) => (
  <IconButton onClick={send}>
    <SendIcon />
  </IconButton>
)
Send.propTypes = { send: PropTypes.func }

const Mic = ({ onEvent }) => (
  <IconButton onClick={onEvent}>
    <MicIcon />
  </IconButton>
)
Mic.propTypes = { onEvent: PropTypes.func.isRequired }

let key = 0

const Input = ({ crisp }) => {
  const [value, setValue] = useState('')
  const [disabled, setDisabled] = useState(false)
  const {
    startRecording,
    stopRecording,
    recordingBlob,
    isRecording,
    mediaRecorder,
  } = useAudioRecorder()
  const start = useCallback(() => {
    startRecording()
    setDisabled(true)
  }, [startRecording])
  const send = useCallback(() => {
    setValue('')
    setDisabled(true)
    key++
    crisp.ownActions
      .prompt(value, key + '')
      .then(console.log)
      .catch(console.error)
      .finally(() => setDisabled(false))
  }, [crisp, value])

  useEffect(() => {
    if (!recordingBlob) {
      return
    }
    const file = new File([recordingBlob], 'recording.webm', {
      type: recordingBlob.type,
    })
    openai.audio.transcriptions
      .create({ file, model: 'whisper-1' })
      .then((transcription) => {
        setValue(transcription.text)
      })
      .catch(console.error)
      .finally(() => setDisabled(false))
  }, [recordingBlob])

  const inputProps = {
    endAdornment: (
      <InputAdornment position="end">
        {value ? (
          <Send send={send} />
        ) : (
          <>
            {isRecording && (
              <LiveAudioVisualizer width={310} mediaRecorder={mediaRecorder} />
            )}
            <Mic onEvent={isRecording ? stopRecording : start} />
          </>
        )}
      </InputAdornment>
    ),
  }
  const { openFilePicker, filesContent, loading } = useFilePicker({
    accept: '.txt',
  })
  if (!disabled) {
    inputProps.startAdornment = (
      <InputAdornment position="start">
        <IconButton onClick={openFilePicker}>
          <Attach fontSize="medium" />
        </IconButton>
      </InputAdornment>
    )
  }

  const onKeyDown = useCallback((e) => {
    const isUnmodified = !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey
    if (e.key === 'Enter' && isUnmodified) {
      e.preventDefault()
      send(value)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setValue('')
    }
  })

  return (
    <TextField
      value={disabled ? ' ' : value}
      multiline
      fullWidth
      variant="outlined"
      label="Input"
      placeholder={disabled ? null : 'Message DreamcatcherGPT...'}
      InputProps={inputProps}
      onChange={(e) => setValue(e.target.value)}
      disabled={disabled}
      onKeyDown={onKeyDown}
    />
  )
}
Input.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default Input
