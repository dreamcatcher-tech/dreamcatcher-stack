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
    debug(`clearLine`)
    terminal.write(clearLineCode)
  }
  terminal.cursorTo = (x, y) => {
    debug(`cursorTo: `, x, y)
    assert.strictEqual(x, 0)
    const leftByOneThousandChars = '\u001b[1000D'
    terminal.write(leftByOneThousandChars)
  }
}

const TerminalContainer = (props) => {
  const xtermRef = useRef()

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

    terminal.open(document.getElementById('xterm-container'))
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
    window.addEventListener('resize', () => {
      fitAddon.fit()
      terminal.columns = terminal.cols
    })
    process.stdout = terminal
    process.stdin = terminal.stdin
    process.stderr = terminal
    terminal.columns = terminal.cols // for enquirer to size itself correctly

    const roboto = new FontFaceObserver('Roboto Mono')

    const isTor = checkIsLikelyTor()
    debug('isTor: ', isTor)
    const fontLoadDelay = 5000000
    const awaits = [roboto.load(null, fontLoadDelay)]
    let fonts = 'Roboto Mono'
    if (isTor) {
      // chrome displays emojis badly
      // TODO get a webfont for emojis that displays correctly and is small
      debug('loading emojis for tor browser')
      const tor = new FontFaceObserver('TorEmoji')
      awaits.push(tor.load('🦄', fontLoadDelay))
      fonts += ', TorEmoji'
    }
    Promise.all(awaits)
      // setting without delay cuases xterm layout bug
      // xterm measures using a huge default if font is not available at render
      .catch((e) => {
        debug('error loading fonts: ', e)
      })
      .then(() => {
        debug('fonts loaded ')
        debug('fonts were: ', terminal.getOption('fontFamily'))
        terminal.setOption('fontFamily', fonts)
        debug('fonts set: ', terminal.getOption('fontFamily'))
        fitAddon.fit() // workaround for xterm blanking existing text on font change
      })
  }, [])
  return <div id="xterm-container" {...props}></div>
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
    if (font.value && font.value[0].family === 'proxima-nova') {
      return false
    }
  }
  return true
}
