#!/usr/bin/env node

const shell = require('.')
const { effectorFactory } = require('../..')

const setup = async () => {
  const blockchain = await effectorFactory('console')
  shell([], { blockchain })
}
setup()
