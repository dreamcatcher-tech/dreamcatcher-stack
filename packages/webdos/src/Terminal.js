import '../css/Terminal.css'
import assert from 'assert'
import React, { useEffect, useRef } from 'react'
import debugFactory from 'debug'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { Unicode11Addon } from 'xterm-addon-unicode11'
import FontFaceObserver from 'fontfaceobserver'
import '@fontsource/roboto-mono'
import 'xterm/css/xterm.css'
import { stdin as mockStdin } from 'mock-stdin'

import '../css/TorEmoji.woff2'

const debug = debugFactory(`terminal:cli`)

const getMockStdin = () => {
  const previousStdin = process.stdin
  mockStdin()
  const { stdin } = process
  Object.defineProperty(process, 'stdin', {
    value: previousStdin,
    writable: true,
  })
  return stdin
}

const convertToStdStream = (terminal) => {
  debug(`toStdStream`)
  const stdin = getMockStdin()
  terminal.stdin = stdin
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
let id = 0
const TerminalContainer = (props) => {
  const xtermRef = useRef()
  const idRef = useRef()
  if (!idRef.current) {
    debug(`setting id`)
    idRef.current = `xterm-container-${id++}`
  }

  useEffect(() => {
    debug(`opening terminal`)
    let isActive = true
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

    terminal.open(document.getElementById(idRef.current))
    fitAddon.fit()
    terminal.focus()
    convertToStdStream(terminal)
    terminal.attachCustomKeyEventHandler((event) => {
      const { key, type } = event
      if (ignoreKeys.includes(key)) {
        debug(`ignoring: ${key} with type: ${type}`)
        return false
      }
    })
    terminal.onKey(({ key, domEvent }) => {
      terminal.stdin.send(key)
    })
    xtermRef.current = terminal
    const resizeListener = () => {
      fitAddon.fit()
      terminal.columns = terminal.cols
    }
    window.addEventListener('resize', resizeListener)
    process.stdout = terminal
    process.stdin = terminal.stdin
    process.stderr = terminal
    terminal.columns = terminal.cols // for enquirer to size itself correctly

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
      const tor = new FontFaceObserver('TorEmoji')
      // const awaitTorLoad = tor
      //   .load('🦄', fontLoadDelay)
      //   .then(() => fonts.push('TorEmoji'))
      //   .catch((e) => debug(`tor load error:`, e))
      // awaits.push(awaitTorLoad)
    }
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
      debug(`terminal being shutdown`)
      window.removeEventListener('resize', resizeListener)
      isActive = false
    }
  }, [])

  return <div id={idRef.current} {...props}></div>
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
