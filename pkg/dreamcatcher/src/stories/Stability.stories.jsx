import { Stability } from './Stability'
import Debug from 'debug'
Debug.enable('*Stability')
import image from './assets/dreamcatcher-sun.jpg'
const prompt =
  'golden dreamcatcher swaying in the breeze overlooking a large city on a sunny day'
const style = 'low-poly'

export default {
  title: 'Dreamcatcher/Stability',
  component: Stability,
  tags: ['autodocs'],
  args: { onImage: () => {} },
}

export const Base = {}
export const WithImage = {
  args: { prompt: 'hello world' },
}
