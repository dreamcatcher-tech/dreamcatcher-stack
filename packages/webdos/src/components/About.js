import React from 'react'
import Debug from 'debug'
import OpenDialog from './OpenDialog'
import { useRouter } from '../hooks'

const debug = Debug('terminal:widgets:About')
debug(`loaded`)

const About = () => {
  const { blocks, match, cwd } = useRouter()
  const [block] = blocks
  if (!block) {
    debug(`not enough info to render`)
    return null
  }
  const { state } = block
  const { title, description } = state.formData || state.schema || {}
  return (
    <OpenDialog title={'About'}>
      <h2>{title}</h2>
      <p>{description}</p>
    </OpenDialog>
  )
}

export default About
