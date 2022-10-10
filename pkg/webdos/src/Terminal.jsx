import assert from 'assert-fast'
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
import commandLineShell from '@dreamcatcher-tech/dos'
import process from 'process'

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
  let engine
  try {
    const { engine: bc } = useBlockchain()
    engine = bc
  } catch (e) {
    console.error(e)
  }
  const [streams, setStreams] = useState()

  useEffect(() => {
    debug(`opening terminal`)
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block', // gets overridden by enquirer
      convertEol: true,
      rendererType: 'dom', // needed in tor browser
      allowProposedApi: true,
      macOptionIsMeta: true,
      smoothScrollDuration: 100,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    const unicode11Addon = new Unicode11Addon()
    terminal.loadAddon(unicode11Addon)
    terminal.unicode.activeVersion = '11'

    terminal.open(document.getElementById(id))
    terminal.focus() // grabs focus in stackblitz
    convertToStdOutStream(terminal)
    let isKey = false
    terminal.attachCustomKeyEventHandler((event) => {
      const { key, type, ctrlKey } = event
      debug(event)
      if (ignoreKeys.includes(key)) {
        debug(`ignoring: ${key} with type: ${type} and ctrl: ${ctrlKey}`)
        return false
      }
      if (ctrlKey && key === 'v') {
        debug('paste')
        return false
      }
      if (ctrlKey && key === 'c') {
        debug('copy')
        return false
      }
      if (key.length === 1) {
        debug('setting isKey')
        isKey = true
      }
    })
    terminal.onData((data) => {
      if (isKey) {
        isKey = false
        debug('key detected')
        return
      }
      debug('paste', data)
      for (const c of data) {
        stdin.send(c)
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
        return
      }
      fitAddon.fit()
      terminal.columns = terminal.cols // for enquirer to size itself correctly
    }
    resizeListener() // set initial sizing
    window.addEventListener('resize', resizeListener)

    let isActive = true
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
    if (engine && streams) {
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
        blockchain: engine,
        ...streams,
      })
      return async () => {
        const abortCmd = await abortCmdPromise
        abortCmd()
      }
    }
  }, [engine, streams])

  return <div {...props} id={id}></div>
}

const ignoreKeys = 'F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12'.split(' ')

export default TerminalContainer
