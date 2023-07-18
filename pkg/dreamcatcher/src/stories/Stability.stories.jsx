import { Stability } from './Stability'
import Debug from 'debug'
Debug.enable('*Stability')

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
