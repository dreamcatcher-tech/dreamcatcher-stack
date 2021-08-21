import { useState, useEffect } from 'react'
import { default as useBlockchain } from './useBlockchain'
import debugFactory from 'debug'
const localProcess = process || {}
const debug = debugFactory(`webdos:hooks:useNavigation`)

export default () => {
  // TODO make urls drive the blockchain, as well as blockchain drive urls
  const { blockchain, context } = useBlockchain()
  const [popstate, setPopstate] = useState()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!blockchain) {
      debug(`popstate not settable`)
      return
    }
    debug(`setting popstate event listener`)
    const onPopstate = ({ state }) => {
      const { wd } = state
      debug(`popstate wd: `, wd)
      // TODO store the current terminal contents, delete back to the prompt
      const command = `cd ${wd}\n`
      for (const c of command) {
        localProcess.stdin.send(c)
      }
      // TODO restore the existing terminal text
      setPopstate(wd)
    }
    window.addEventListener('popstate', onPopstate)
    return () => {
      window.removeEventListener('popstate', onPopstate)
    }
  }, [blockchain])

  if (!context) {
    return
  }
  const { wd } = context
  useEffect(() => {
    if (window.location.pathname !== wd) {
      debug(`oneShot window.location.pathname !== wd`)
      blockchain.cd(window.location.pathname).catch((e) => {
        debug(`pathname mismatch ${wd} ${e.message}`)
      })
    }
    setIsInitialized(true)
  }, [])

  if (!isInitialized) {
    return
  }

  if (window.location.pathname !== wd) {
    debug(`window.history.pushState: `, wd)
    if (!popstate) {
      debug(`command was not from history`)
      window.history.pushState({ wd }, '', wd)
      window.history.replaceState({ wd }, '', wd)
      document.title = wd
    } else {
      debug(`command was from history`)
    }
  } else {
    if (popstate) {
      setPopstate()
    }
  }
}
