import React, { Component } from 'react'
import { render } from 'react-dom'
import { Blockchain, Terminal, Router } from '../../src'
import Debug from 'debug'
import { crm } from './crm'
import cov from './covenant'
import multi from './multi'

Debug.enable('covenant* *Blockchain *shell*')
/**
 * Have to be able to install without publishing.
 * Must install if the app not already installed. ? ensureInstall() ?
 * In dev, must be able to set up a full system, and load fake data.
 *
 * Hot patch already published code, so we override the execution ?
 */

export default class Demo extends Component {
  render() {
    return (
      <div>
        <h1>dosweb Demo</h1>
        <Blockchain dev={multi}>
          <Router>
            <Terminal path="/" style={{ height: '80vh' }} />
          </Router>
        </Blockchain>
      </div>
    )
  }
}

render(<Demo />, document.querySelector('#demo'))
