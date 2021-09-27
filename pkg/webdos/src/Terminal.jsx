import './Terminal.css'
import { assert } from 'chai/index.mjs'
import React, { useEffect, useState } from 'react'
import debugFactory from 'debug'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { Unicode11Addon } from 'xterm-addon-unicode11'
import FontFaceObserver from 'fontfaceobserver'
import '@fontsource/roboto-mono'
import 'xterm/css/xterm.css'
import { stdin as mockStdin } from 'mock-stdin-browserify'
import { useBlockchain } from './hooks'
import commandLineShell from '@dreamcatcher-tech/dos' // in build, gets aliased to @dreamcatcher-tech/dos
import process from 'process'
// import '../css/TorEmoji.woff2'

const debug = debugFactory(`terminal:Terminal`)

const getMockStdin = () => {
  const isDetached = true
  const stdin = mockStdin(isDetached)
  return stdin
}

const convertToStdOutStream = (terminal) => {
  debug(`toStdStream`)
  terminal.isTTY = true
  const clearLineCode = '\u001b[2K'
  terminal.clearLine = () => {
    // debug(`clearLine`)
    terminal.write(clearLineCode)
  }
  assert(!terminal.moveCursor)
  terminal.moveCursor = (x, y) => {
    debug('moveCursor', x, y)
  }
  terminal.cursorTo = (x, y) => {
    // required for ora 4.1.? and above
    // debug(`cursorTo: `, x, y)
    assert.strictEqual(x, 0)
    const leftByOneThousandChars = '\u001b[1000D'
    terminal.write(leftByOneThousandChars)
  }
  terminal.on = (eventName, callback) => {
    // required for ora 5.4.1
    debug(`terminal.on( ${eventName} )`)
  }
  terminal.once = (eventName, callback) => {
    // required for ora 5.4.1
    debug(`terminal.once( ${eventName} )`)
  }
  terminal.emit = (eventName, callback) => {
    // required for ora 5.4.1
    debug(`terminal.emit( ${eventName} )`)
  }
}
const TerminalContainer = (props) => {
  let { id = '0' } = props
  id = `xterm-container-${id}`
  let blockchain
  try {
    const { blockchain: bc } = useBlockchain()
    blockchain = bc
  } catch (e) {
    debugger
    const thing = useBlockchain()
  }
  const [streams, setStreams] = useState()

  useEffect(() => {
    debug(`opening terminal`)
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block', // gets overridden by enquirer
      convertEol: true,
      rendererType: 'dom', // needed in tor browser
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    const unicode11Addon = new Unicode11Addon()
    terminal.loadAddon(unicode11Addon)
    terminal.unicode.activeVersion = '11'

    terminal.open(document.getElementById(id))
    // terminal.focus() // grabs focus in stackblitz
    convertToStdOutStream(terminal)
    terminal.attachCustomKeyEventHandler((event) => {
      const { key, type } = event
      if (ignoreKeys.includes(key)) {
        debug(`ignoring: ${key} with type: ${type}`)
        return false
      }
    })
    // TODO skip stdin mocking and use direct objects somehow ?
    const stdin = getMockStdin()
    const streams = { stdout: terminal, stdin, stderr: terminal }
    setStreams(streams)
    terminal.onKey(({ key, domEvent }) => {
      stdin.send(key)
    })
    const resizeListener = () => {
      const term = document.getElementById(id)
      if (term.getClientRects().length === 0) {
        debug(`avoided throw from fitAddon.fit() on hidden element`)
        debugger
        return
      }
      fitAddon.fit()
      terminal.columns = terminal.cols // for enquirer to size itself correctly
    }
    resizeListener() // set initial sizing
    window.addEventListener('resize', resizeListener)

    const isTor = checkIsLikelyTor()
    debug(`isTor: ${isTor}`)
    const fontLoadDelay = 5000000
    const fonts = []
    const awaits = []
    const roboto = new FontFaceObserver('Roboto Mono')
    // const awaitRobotoLoad = roboto
    //   .load(null, fontLoadDelay)
    //   .then(() => fonts.push('Roboto Mono'))
    //   .catch((e) => debug(`roboto load error:`, e))
    // awaits.push(awaitRobotoLoad)
    if (isTor) {
      // chrome displays emojis badly
      // TODO get a webfont for emojis that displays correctly and is small
      debug('loading emojis for tor browser')
      // const tor = new FontFaceObserver('TorEmoji')
      // const awaitTorLoad = tor
      //   .load('🦄', fontLoadDelay)
      //   .then(() => fonts.push('TorEmoji'))
      //   .catch((e) => debug(`tor load error:`, e))
      // awaits.push(awaitTorLoad)
    }
    let isActive = true
    Promise.all(awaits)
      // setting without delay causes xterm layout bug
      // xterm measures using a huge default if font is not available at render
      .then(() => {
        if (fonts.length && isActive) {
          const fontsString = fonts.join(', ')
          debug('fonts loaded: ', fontsString)
          debug('fonts were: ', terminal.getOption('fontFamily'))
          terminal.setOption('fontFamily', fontsString)
          debug('fonts set: ', terminal.getOption('fontFamily'))
          fitAddon.fit() // workaround for xterm blanking existing text on font change
        }
      })
      .catch((e) => {
        debug('error loading fonts: ', e)
      })
    debug('terminal ready')

    return () => {
      debug(`terminal being shutdown`, id)
      window.removeEventListener('resize', resizeListener)
      isActive = false
      terminal.dispose()
      setStreams()
    }
  }, [id])

  useEffect(() => {
    if (blockchain && streams) {
      const { stdout, stdin, stderr } = streams
      Object.defineProperty(process, 'stdin', {
        value: stdin,
        writable: true,
      })
      // TODO allow multiple simultaneous stdins
      process.stdin = stdin
      process.stdout = stdout // TODO wrap ora so it sees a fake process object
      process.stderr = stderr

      const emptyArgs = []
      const abortCmdPromise = commandLineShell(emptyArgs, {
        blockchain,
        ...streams,
      })
      return async () => {
        const abortCmd = await abortCmdPromise
        abortCmd()
      }
    }
  }, [blockchain, streams])

  return <div {...props} id={id}></div>
}

const ignoreKeys = 'F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12'.split(' ')

export default TerminalContainer

const checkIsLikelyTor = () => {
  const { fonts } = document
  const it = fonts.entries()
  let done = false
  while (!done) {
    const font = it.next()
    done = font.done
    if (!done) {
      debug(`font: %o`, font.value)
    }
    if (
      font.value &&
      font.value[0] &&
      font.value[0].family === 'proxima-nova'
    ) {
      return false
    }
  }
  return true
}
