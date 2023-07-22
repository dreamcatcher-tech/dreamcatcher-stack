import { useState } from 'react'
import OutlinedInput from '@mui/material/OutlinedInput'
import InputLabel from '@mui/material/InputLabel'
import InputAdornment from '@mui/material/InputAdornment'
import FormControl from '@mui/material/FormControl'
import SendIcon from '@mui/icons-material/Send'
import LoadingButton from '@mui/lab/LoadingButton'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardMedia from '@mui/material/CardMedia'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import PropTypes from 'prop-types'
import { styles } from '../covenants/template'
import 'jimp/browser/lib/jimp.js'
const { Jimp } = globalThis
import Debug from 'debug'
const debug = Debug('dreamcatcher:Stability')
const CLIPDROP_URL = 'https://clipdrop-api.co/text-to-image/v1'
// TODO move to https://platform.stability.ai/rest-api

const styleMenuItems = styles.map((style, key) => (
  <MenuItem value={style} key={key}>
    {style || '(No Style)'}
  </MenuItem>
))

export const Stability = ({ onImage, prompt, style, image }) => {
  const [newPrompt, setNewPrompt] = useState(prompt)
  const [newStyle, setNewStyle] = useState(style || styles[1])
  const [isRequesting, setIsRequesting] = useState(false)
  const [newImage, setNewImage] = useState(
    image || 'https://dreamcatcher.land/img/dreamcatcher.svg'
  )

  const handleGenerate = async () => {
    debug('click')
    setIsRequesting(true)
    const form = new FormData()
    form.append('prompt', newPrompt)
    form.append('preset', newStyle)
    console.log('form', [...form.entries()])
    const response = await fetch(CLIPDROP_URL, {
      method: 'POST',
      headers: { 'x-api-key': import.meta.env.VITE_CLIPDROP_API_KEY },
      body: form,
    })

    const buffer = await response.arrayBuffer()
    const image = await Jimp.read(buffer)
    image.quality(90)
    const uri = await image.getBase64Async(Jimp.MIME_JPEG)
    setNewImage(uri)
    setIsRequesting(false)
    onImage({ prompt: newPrompt, style: newStyle, image: uri })
  }
  const handleStyle = (event) => {
    setNewStyle(event.target.value)
  }
  const handleKeyDown = (event) => {
    debug('User pressed: ', event.key)
    if (event.key === 'Enter') {
      if (newPrompt) {
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
        image={newImage}
        title={newPrompt}
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
                  value={newStyle}
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
                  disabled={!newPrompt}
                />
              </InputAdornment>
            }
            label="Prompt"
            onChange={(event) => setNewPrompt(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRequesting}
            defaultValue={prompt}
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
   * - `style`: The style that was used to generate the image.
   * - `image`: The image data as a base64 encoded string.
   */
  onImage: PropTypes.func.isRequired,

  /**
   * The prompt that was used to generate the image, if any
   */
  prompt: PropTypes.string,

  /**
   * The style used to generate the image, if any
   */
  style: PropTypes.string,

  /**
   * The existing image, if any, as either a url or a base64 encoded string.
   */
  image: PropTypes.string,
}
