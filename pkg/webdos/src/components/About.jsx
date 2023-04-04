import React from 'react'
import Debug from 'debug'
import { Crisp } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'

const debug = Debug('terminal:widgets:About')
debug(`loaded`)

const About = ({ crisp }) => {
  if (!crisp || crisp.isLoading) {
    return
  }
  return (
    <OpenDialog title={'About'}>
      <h2>{title}</h2>
      <p>{description}</p>
    </OpenDialog>
  )
}
About.propTypes = { crisp: PropTypes.instanceOf(Crisp) }

export default About
