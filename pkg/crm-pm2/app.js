import Debug from 'debug'
import * as dotenv from 'dotenv'
import JSONbig from 'json-bigint'
import pmx from '@pm2/io'
import { Interpulse, apps } from '@dreamcatcher-tech/interblock'
import { createRequire } from 'module'
import process from 'process'
import chalk from 'ansi-colors-browserify'
import cliui from 'cliui'
import du from 'du'
import assert from 'assert-fast'
dotenv.config()
dotenv.config({ path: '../../../../../../.env' }) // for pm2 module installation
const require = createRequire(import.meta.url)
const moduleJson = require('./package.json')
const interblockJson = require('@dreamcatcher-tech/interblock/package.json')
const { crm } = apps
const debug = Debug('crm:pm2')

Debug.enable('crm:pm2* *PulseNet')

debug('starting pm2 app version:', moduleJson.version)
debug('node version', process.version)

pmx.initModule({
  widget: {
    logo: 'https://app.keymetrics.io/img/logo/keymetrics-300.png',
    theme: ['#141A1F', '#222222', '#3ff', '#3ff'],
    el: { probes: true, actions: true },
    block: {
      actions: true,
      issues: true,
      meta: true,
    },
  },
})

const boot = async () => {
  debug('pwd', process.cwd())
  const { PORT, WITH_FAKE_DATA, ADMIN_CHAIN_ID, REPO, SSL_HOSTNAME } =
    process.env
  debug('PORT', PORT)
  debug('WITH_FAKE_DATA', WITH_FAKE_DATA)
  debug('ADMIN_CHAIN_ID', ADMIN_CHAIN_ID)
  debug('REPO', REPO)
  debug('SSL_HOSTNAME', SSL_HOSTNAME) // loaded from .env file in project root
  debug(
    `Starting CRM blockchain engine...
      @dreamcatcher-tech/interblock:    v${interblockJson.version}
      @dreamcatcher-tech/crm-pm2:       v${moduleJson.version}
      `
  )
  const tcpHost = '0.0.0.0'
  const tcpPort = PORT || '8789'
  const repo = REPO || './crm-pm2-repo'
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
    js.pwd = process.cwd()
    js.repo = repo
    cb(js)
  })

  const custPerSec = pmx.metric({ name: 'Customers / sec' })
  custPerSec.set(0)
  if (WITH_FAKE_DATA) {
    const addFakeCustomers = async (count, reply) => {
      assert(Number.isInteger(count))
      assert.strictEqual(typeof reply, 'function')
      debug('action: fake', count)
      const bounds = crm.faker.routing.generateBatch()
      const customers = await engine.latest('/app/customers')
      const {
        formData: { maxCustNo },
      } = customers.getState().toJS()

      crm.faker.customers.setCustNo(maxCustNo + 1)
      const noReset = true
      const fullBatch = crm.faker.customers.generateBatchInside(
        bounds,
        count,
        noReset
      )
      debug('fake data', fullBatch.length, 'customers')
      let batch = []
      let total = 0
      for (const customer of fullBatch) {
        batch.push(customer)
        const batchSize = 50
        if (batch.length % batchSize === 0 || batch.length === count) {
          const start = Date.now()
          await engine.execute('/app/customers/batch', { batch })
          custPerSec.set(batchSize / ((Date.now() - start) / 1000))
          debug('Fake data added ' + batch.length + ' customers')
          total += batch.length
          batch = []
        }
      }
      reply('Fake data added ' + total + ' customers')
      doDu()
    }

    pmx.action('10', (reply) => addFakeCustomers(10, reply))
    pmx.action('100', (reply) => addFakeCustomers(100, reply))
    pmx.action('1,000', (reply) => addFakeCustomers(1000, reply))
    pmx.action('10,000', (reply) => addFakeCustomers(10000, reply))
    pmx.action('Hard Reset', async (reply) => {
      debug('action: Hard Reset')
      await engine.hardReset()
      reply('Reset complete.  Restart the service to start fresh')
      setTimeout(process.exit, 800)
    })
    pmx.action('Soft Reset', async (reply) => {
      debug('action: Soft Reset')
      // keep the keys of the engine, but reset everything else
      reply('not implemented yet')
    })
  }
  pmx.action('ID', async (reply) => {
    debug('action: ID')
    const id = await engine.getIdentifiers('/app')
    reply(id)
  })
  pmx.action('Import', async (reply) => {
    debug('action: Import')
    // try connect to moneyworks
    // begin pulling in customers and updating them
    // report progress to the user
    // TODO make this be a scoped action that takes a long time
    reply('Importing complete')
    doDu()
  })

  let duSize
  function doDu() {
    debug('du start')
    du(repo, { disk: true }, (err, size) => {
      if (err) {
        debug('du error', err)
      }
      duSize = size
      debug('du complete', size)
    })
  }
  doDu()
  pmx.metric({
    name: 'du',
    unit: 'bytes',
    value: () => {
      return duSize
    },
  })
  process.on('SIGINT', async () => {
    debug('SIGINT')
    let result
    try {
      result = await engine.stop()
      debug('engine stopped')
    } catch (error) {
      debug('error stopping engine', error)
    }
    process.exit(result ? 0 : 1)
  })
  process.send('ready')
}
boot()
