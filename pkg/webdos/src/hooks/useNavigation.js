import { useState, useEffect } from 'react'
import { default as useBlockchain } from './useBlockchain'
import debugFactory from 'debug'
const debug = debugFactory(`webdos:hooks:useNavigation`)

export default () => {
  const { engine, wd } = useBlockchain()

  const [popstate, setPopstate] = useState()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!engine) {
      debug(`popstate not settable`)
      return
    }
    debug(`setting popstate event listener`)
    const onPopstate = ({ state }) => {
      const { wd } = state
      debug(`popstate wd: `, wd)
      engine.cd(wd)
      setPopstate(wd)
    }
    window.addEventListener('popstate', onPopstate)
    return () => {
      window.removeEventListener('popstate', onPopstate)
    }
  }, [engine])

  if (!wd) {
    return
  }
  document.title = wd
  useEffect(() => {
    if (window.location.pathname !== wd) {
      debug(`oneShot window.location.pathname !== wd`)
      engine.cd(window.location.pathname).catch((e) => {
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
