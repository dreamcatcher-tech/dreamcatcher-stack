import expect from 'expect'
import React from 'react'
import { render, unmountComponentAtNode } from 'react-dom'

import { Terminal } from 'src/'

describe('Terminal', () => {
  let node

  beforeEach(() => {
    node = document.createElement('div')
  })

  afterEach(() => {
    unmountComponentAtNode(node)
  })

  it('displays a welcome message', () => {
    render(<Terminal />, node, () => {
      expect(node.innerHTML).toContain('Welcome to React components')
    })
  })
})
