import React, { Component } from 'react'
import { render } from 'react-dom'
import { Blockchain, Terminal } from '../../src'

export default class Demo extends Component {
  render() {
    return (
      <div>
        <h1>dosweb Demo</h1>
        <Blockchain>
          <Terminal
            path="/"
            style={{ height: '80vh', backgroundColor: 'black' }}
          />
        </Blockchain>
      </div>
    )
  }
}

render(<Demo />, document.querySelector('#demo'))
