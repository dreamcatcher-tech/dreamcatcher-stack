import React from 'react'
import Debug from 'debug'
import OpenDialog from './OpenDialog'

const debug = Debug('terminal:widgets:About')
debug(`loaded`)

const About = ({ block, path, cwd }) => {
  const { state } = block
  const { title, description } = state.formData
  return (
    <OpenDialog title={'About'}>
      <h2>{title}</h2>
      <p>{description}</p>
    </OpenDialog>
  )
}

export default About
