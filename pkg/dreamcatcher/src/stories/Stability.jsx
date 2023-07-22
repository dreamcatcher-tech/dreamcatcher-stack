import * as React from 'react'
import { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Input from '@mui/material/Input'
import FilledInput from '@mui/material/FilledInput'
import OutlinedInput from '@mui/material/OutlinedInput'
import InputLabel from '@mui/material/InputLabel'
import InputAdornment from '@mui/material/InputAdornment'
import FormHelperText from '@mui/material/FormHelperText'
import FormControl from '@mui/material/FormControl'
import TextField from '@mui/material/TextField'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import SendIcon from '@mui/icons-material/Send'
import LoadingButton from '@mui/lab/LoadingButton'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import CardMedia from '@mui/material/CardMedia'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('dreamcatcher:Stability')
const CLIPDROP_URL = 'https://clipdrop-api.co/text-to-image/v1'
// TODO move to https://platform.stability.ai/rest-api

const styles = [
  'anime',
  'photographic',
  'digital-art',
  'enhance',
  'comic-book',
  'fantasy-art',
  'analog-film',
  'neon-punk',
  'isometric',
  'low-poly',
  'origami',
  'line-art',
  'cinematic',
  '3d-model',
  'pixel-art',
  'modeling-compound',
  'tile-texture',
]
const styleMenuItems = styles.map((style, key) => (
  <MenuItem value={style} key={key}>
    {style}
  </MenuItem>
))
styleMenuItems.unshift(
  <MenuItem value="" key={-1}>
    <em>None</em>
  </MenuItem>
)

export const Stability = ({ onImage }) => {
  const [prompt, setPrompt] = useState()
  const [style, setStyle] = useState('low-poly')
  const [isRequesting, setIsRequesting] = useState(false)
  const [image, setImage] = useState(
    'https://dreamcatcher.land/img/dreamcatcher.svg'
  )

  const handleGenerate = async () => {
    debug('click')
    setIsRequesting(true)
    const form = new FormData()
    form.append('prompt', prompt)
    form.append('preset', style)
    console.log('form', [...form.entries()])
    const response = await fetch(CLIPDROP_URL, {
      method: 'POST',
      headers: { 'x-api-key': import.meta.env.VITE_CLIPDROP_API_KEY },
      body: form,
    })

    const image = await response.blob()
    const url = URL.createObjectURL(image)
    // URL.revokeObjectURL(img.src); // free memory
    setImage(url)
    setIsRequesting(false)
    onImage({ prompt, image })
  }
  const handleStyle = (event) => {
    setStyle(event.target.value)
  }
  const handleKeyDown = (event) => {
    debug('User pressed: ', event.key)
    if (event.key === 'Enter') {
      if (prompt) {
        handleGenerate()
      }
    }
  }
  return (
    <Card>
      <CardMedia
        sx={{ objectFit: 'contain' }}
        component="img"
        height={400}
        image={image}
        title={prompt}
      />
      <CardContent>
        <FormControl fullWidth variant="outlined">
          <InputLabel htmlFor="outlined-adornment">Prompt</InputLabel>
          <OutlinedInput
            id="outlined-adornment"
            endAdornment={
              <InputAdornment position="end">
                <Select
                  sx={{ m: 1, width: 150 }}
                  value={style}
                  label="Style"
                  onChange={handleStyle}
                  disabled={isRequesting}
                >
                  {styleMenuItems}
                </Select>
                <LoadingButton
                  onClick={handleGenerate}
                  endIcon={<SendIcon />}
                  loading={isRequesting}
                  loadingPosition="end"
                  variant="contained"
                  disabled={!prompt}
                />
              </InputAdornment>
            }
            label="Prompt"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            multiline
            disabled={isRequesting}
          />
        </FormControl>
      </CardContent>
    </Card>
  )
}
Stability.propTypes = {
  /**
   * Callback to be called when the image is loaded.
   * Is passed an object with the following properties:
   * - `prompt`: The prompt that was used to generate the image.
   * - `image`: The image data as a base64 encoded string.
   */
  onImage: PropTypes.func.isRequired,
}
