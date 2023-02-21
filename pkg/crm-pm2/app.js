import Debug from 'debug'
import JSONbig from 'json-bigint'
import pmx from '@pm2/io'
import { Interpulse, apps } from '@dreamcatcher-tech/interblock'
import { createRequire } from 'module'
import process from 'process'
import chalk from 'ansi-colors-browserify'
import cliui from 'cliui'
const require = createRequire(import.meta.url)
const moduleJson = require('./package.json')
const interblockJson = require('@dreamcatcher-tech/interblock/package.json')
const { crm } = apps
const debug = Debug('crm:pm2')

Debug.enable('crm:pm2* iplog')

debug('starting pm2 app version:', moduleJson.version)
debug('node version', process.version)

/**
--faker 123 Generate fake data, using the given number of customers

--admin rootChainId Supply a chainId to allow to connect without being authd

.env provided as a file which holds SSL keys. If a .env file is found at the same place as the repo, it will be loaded ie: repo/.env will be loaded.


 */
const config = pmx.initModule({
  widget: {
    logo: 'https://app.keymetrics.io/img/logo/keymetrics-300.png',
    theme: ['#141A1F', '#222222', '#3ff', '#3ff'],
    el: { probes: true, actions: true },
    block: {
      actions: true,
      issues: true,
      meta: true,
      // main_probes: ['test-probe'],
    },
  },
})
debug.extend('init')('config', config)

const boot = async () => {
  const { PORT, WITH_FAKE_DATA, ADMIN_CHAIN_ID, REPO, SSL_PATH } = process.env
  debug('PORT', PORT)
  debug('WITH_FAKE_DATA', WITH_FAKE_DATA)
  debug('ADMIN_CHAIN_ID', ADMIN_CHAIN_ID)
  debug('REPO', REPO)
  debug('SSL_PATH', SSL_PATH) // load the keys from this path
  debug(
    `Starting CRM blockchain engine...
      @dreamcatcher-tech/interblock:    v${interblockJson.version}
      @dreamcatcher-tech/crm-pm2:       v${moduleJson.version}
      `
  )
  const tcpHost = '0.0.0.0'
  const tcpPort = PORT || '8789'
  const repo = REPO || '../../tmp/crm-pm2-test'
  const overloads = { '/crm': crm.covenant }
  const engine = await Interpulse.create({ repo, tcpHost, tcpPort, overloads })
  debug('blockchain started')

  const latest = await engine.latest()
  const chainId = latest.getAddress().getChainId()
  const peerId = await engine.net.keypair.generatePeerId()
  const ui = cliui()
  ui.div({ text: `Root:`, width: 15 }, chainId)
  ui.div({ text: `Machine:`, width: 15 }, chalk.green(peerId))
  ui.div({ text: `Repo path:`, width: 15 }, engine.net.repo.path)

  const addrs = engine.net.getMultiaddrs()
  if (!addrs.length) {
    addrs.push(chalk.red(`NOT LISTENING`))
  }
  for (const addr of addrs) {
    ui.div({ text: `Address:`, width: 15 }, addr)
  }
  console.log(ui.toString())
  debug('stats', await engine.stats())

  if (engine.isCreated) {
    debug('begin app install on uninitialized engine')
    const config = { isPublicChannelOpen: true }
    await engine.add('/app', { covenant: '/crm', config })
    const allSectors = crm.faker.routing.generateBatch()
    await engine.execute('/app/routing/batch', { batch: allSectors })
    debug('app installaction complete')
  }
  const serve = await engine.serve('/app')
  debug('serve', serve)

  pmx.action('stats', async (cb) => {
    debug('action: stats')
    const stats = await engine.stats()
    const string = JSONbig.stringify(stats, null, 2)
    const js = JSON.parse(string)
    cb(js)
  })
  pmx.action('100', async (cb) => {
    debug('action: fake')
    const bounds = crm.faker.routing.generateBatch()
    const customers = await engine.latest('/app/customers')
    const {
      formData: { maxCustNo },
    } = customers.getState().toJS()

    crm.faker.customers.setCustNo(maxCustNo + 1)
    const noReset = true
    const fullBatch = crm.faker.customers.generateBatchInside(
      bounds,
      100,
      noReset
    )
    debug('fake data', fullBatch.length, 'customers')
    let batch = []
    let count = 0
    for (const customer of fullBatch) {
      batch.push(customer)
      if (batch.length % 50 === 0) {
        await engine.execute('/app/customers/batch', { batch })
        count += batch.length
        batch = []
        debug('Fake data added ' + count + ' customers')
      }
    }
    cb('Fake data added ' + count + ' customers')
  })
  pmx.action('1,000', async (cb) => {
    debug('action: fake')
    const bounds = crm.faker.routing.generateBatch()
    const customers = await engine.latest('/app/customers')
    const {
      formData: { maxCustNo },
    } = customers.getState().toJS()

    crm.faker.customers.setCustNo(maxCustNo + 1)
    const noReset = true
    const fullBatch = crm.faker.customers.generateBatchInside(
      bounds,
      1000,
      noReset
    )
    debug('fake data', fullBatch.length, 'customers')
    let batch = []
    let count = 0
    for (const customer of fullBatch) {
      batch.push(customer)
      if (batch.length % 50 === 0) {
        await engine.execute('/app/customers/batch', { batch })
        count += batch.length
        batch = []
        debug('Fake data added ' + count + ' customers')
      }
    }
    cb('Fake data added ' + count + ' customers')
  })
  pmx.action('10,000', async (cb) => {
    debug('action: fake')
    const bounds = crm.faker.routing.generateBatch()
    const customers = await engine.latest('/app/customers')
    const {
      formData: { maxCustNo },
    } = customers.getState().toJS()

    crm.faker.customers.setCustNo(maxCustNo + 1)
    const noReset = true
    const fullBatch = crm.faker.customers.generateBatchInside(
      bounds,
      10000,
      noReset
    )
    debug('fake data', fullBatch.length, 'customers')
    let batch = []
    let count = 0
    for (const customer of fullBatch) {
      batch.push(customer)
      if (batch.length % 50 === 0) {
        await engine.execute('/app/customers/batch', { batch })
        count += batch.length
        batch = []
        debug('Fake data added ' + count + ' customers')
      }
    }
    cb('Fake data added ' + count + ' customers')
  })
  pmx.action('Hard Reset', async (cb) => {
    debug('action: Hard Reset')
    await engine.hardReset()
    cb('Reset complete.  Restart the service to start fresh')
    setTimeout(process.exit, 1000)
  })
  pmx.action('ID', async (cb) => {
    debug('action: ID')
    const id = await engine.getIdentifiers('/app')
    cb(id)
  })
  pmx.action('Import', async (cb) => {
    debug('action: Import')
    // try connect to moneyworks
    // begin pulling in customers and updating them
    // report progress to the user
    // TODO make this be a scoped action that takes a long time
    cb('Importing complete')
  })
}
boot()
