import React from 'react'
import Debug from 'debug'

const debug = Debug('terminal:widgets:Account')

const Account = ({ block, path, cwd }) => {
  const { state } = block
  debug(`state`, state)
  // const { title, description } = state.formData
  const title = 'Account'
  const description = 'Account Description'
  return (
    <>
      <h2>{title}</h2>
      <p>{description}</p>
    </>
  )
}

export default Account
