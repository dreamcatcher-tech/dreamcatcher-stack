import React from 'react'
import ReactDOM from 'react-dom/client'
import Debug from 'debug'
const debug = Debug('client:tests:App')

import Demo from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>
)

const { VITE_GIT_HASH, VITE_GIT_DATE } = globalThis
if (VITE_GIT_HASH && VITE_GIT_DATE) {
  const date = new Date(VITE_GIT_DATE)
  console.log('commit hash:', VITE_GIT_HASH)
  console.log(
    'commit date:',
    new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(date)
  )
}
