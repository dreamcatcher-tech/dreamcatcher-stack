import { useState, useEffect } from 'react'
import { useBlockchain } from './useBlockchain'
import debugFactory from 'debug'

const debug = debugFactory(`terminal:useNavigation`)
export const useNavigation = () => {
  // TODO make urls drive the blockchain, as well as blockchain drive urls
  const { blockchain, context } = useBlockchain()
  const [popstate, setPopstate] = useState()

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
        process.stdin.send(c)
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
