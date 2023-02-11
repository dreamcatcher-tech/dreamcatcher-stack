import Debug from 'debug'
import pmx from 'pmx'
import { Interpulse } from '@dreamcatcher-tech/interblock'
import { createRequire } from 'module'
import process from 'process'
const require = createRequire(import.meta.url)
const moduleJson = require('./package.json')
const interblockJson = require('@dreamcatcher-tech/interblock/package.json')

const debug = Debug('crm:pm2')
Debug.enable('crm:pm2* iplog')
debug('starting pm2 app version:', moduleJson.version)
debug('node version', process.version)

/**
--faker 123 Generate fake data, using the given number of customers

--port 1234 Listen on the given port number, or use a default random one

--admin rootChainId Supply a chainId to allow to connect without being authd

repo required as this is installed globally, so must say where the repo will be. KV store is in repo/interpulse/.

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
      main_probes: ['test-probe'],
    },
  },
})
debug.extend('init')('config', config)

const boot = async () => {
  debug('PORT', process.env.PORT)
  debug('WITH_FAKE_DATA', process.env.WITH_FAKE_DATA)
  debug('ADMIN_ROOT_CHAIN_ID', process.env.ADMIN_ROOT_CHAIN_ID)
  debug('REPO', process.env.REPO)
  debug('SSL_PATH', process.env.SSL_PATH) // load the keys from this path
  debug(
    `Starting CRM blockchain engine...
      @dreamcatcher-tech/interblock:    v${interblockJson.version}
      @dreamcatcher-tech/crm-pm2:       v${moduleJson.version}
      `
  )
}
boot()
