import PropTypes from 'prop-types'
import assert from 'assert-fast'
import React, { useState, useEffect, useRef } from 'react'
import { Interpulse } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('webdos:Complex')

export default function Complex({
  engine,
  path,
  latest,
  state,
  wd,
  isPending,
}) {
  debug(engine, path)
  return <div>Complex</div>
}
Complex.propTypes = {
  engine: PropTypes.instanceOf(Interpulse),
  /**
   * What path is the root of this Complex ?
   */
  path: PropTypes.string.isRequired,
  /**
   * Should a full sync be maintained for the tree at this path ?
   */
  sync: PropTypes.bool,
}
