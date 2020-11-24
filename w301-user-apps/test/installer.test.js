const assert = require('assert')
const { effectorFactory } = require('../..')
const debug = require('debug')('crm:tests:installer')
const { installer } = require('../src/installer')
require('debug').enable('*met*')
describe('installer', () => {
  test.only('installation unfurls basic structure', async () => {
    const root = await effectorFactory('install', { installer })
    root.enableLogging()
    await root.add('crm', 'installer')
    const result = await root.crm.install()

    await root.settle()
  })
})
