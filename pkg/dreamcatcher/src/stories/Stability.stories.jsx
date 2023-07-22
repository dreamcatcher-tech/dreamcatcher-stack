import { Stability } from './Stability'
import Debug from 'debug'
import image from './assets/dreamcatcher-sun.jpg'
import base64Image from './assets/base64Image'
const debug = Debug('dreamcatcher:Stability')
const prompt =
  'golden dreamcatcher swaying in the breeze overlooking a large city on a sunny day'
const style = 'low-poly'
export default {
  title: 'Dreamcatcher/Stability',
  component: Stability,
  tags: ['autodocs'],
  args: {
    onImage: (result) => {
      Debug.enable('*Stability')
      debug('onImage', result)
    },
  },
}

export const Base = {}
export const WithImage = {
  args: { prompt: 'hello world', image },
}

export const WithBase64Image = {
  args: { prompt, style, image: base64Image },
}
