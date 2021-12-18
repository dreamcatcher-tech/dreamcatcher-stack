import assert from 'assert-fast'
import { RxReply, Dmz, CovenantId, RxRequest } from '../../w015-models'
import { spawn, spawnRequester } from './spawn'
import { interchain, replyResolve, replyPromise } from '../../w002-api'
import Debug from 'debug'
import { metaProducer } from '../../w016-producers'
const debug = Debug('interblock:dmz:deploy')

const install = (installer) => ({
  type: '@@INSTALL',
  payload: { installer },
})
const deploy = (installer) => ({
  type: '@@DEPLOY',
  payload: { installer },
})
const deployReducer = (dmz, action) => {
  assert(dmz instanceof Dmz)
  assert(!dmz.meta.deploy)
  assert(action instanceof RxRequest)
  assert(action.type === '@@DEPLOY' || action.type === '@@INSTALL')
  const { installer } = action.payload
  // TODO assert there is only one deployment action, from parent, and after genesis
  // TODO check format of payload.installer against schema
  // TODO check top level matches this current state
  // TODO clean up failed partial deployments ?
  // TODO ? allow specify state in the topmost chain ?
  // TODO accomodate existing children already ? or throw ?
  const { children: directChildren = {} } = installer
  // TODO try make promises that work on a specific action, so can run in parallel
  if (!Object.keys(directChildren).length) {
    return dmz
  }
  replyPromise()
  let { meta } = dmz
  const deploySlice = { originIdentifier: action.identifier }
  const height = dmz.getCurrentHeight()
  for (const installPath in directChildren) {
    let {
      children,
      covenant,
      state = {},
      ...spawnOptions
    } = directChildren[installPath]
    covenant = covenant || 'unity'
    const covenantId = CovenantId.create(covenant)
    spawnOptions = { ...spawnOptions, covenantId, state }
    const spawnRequest = spawn(installPath, spawnOptions)
    const [nextDmz, spawnId, alias, chainId] = spawnRequester(dmz, spawnRequest)
    dmz = nextDmz
    assert(!meta.replies[spawnId])
    const slice = { type: '@@DEPLOY_GENESIS', alias }
    meta = metaProducer.withSlice(meta, spawnId, slice)
    const secondRequestIndex = 1
    const deployId = `${chainId}_${height}_${secondRequestIndex}`
    const deployAction = deploy(directChildren[installPath])
    interchain(deployAction, installPath)
    assert(!meta.replies[deployId])
    meta = metaProducer.withSlice(meta, deployId, { type: '@@DEPLOY' })
    assert(!deploySlice[deployId])
    deploySlice[deployId] = alias
  }
  meta = { ...meta, deploy: deploySlice }
  return Dmz.clone({ ...dmz, meta })
}
const deployGenesisReply = (meta, rxReply, dmz) => {
  assert.strictEqual(typeof meta, 'object')
  assert(rxReply instanceof RxReply)
  assert(dmz instanceof Dmz)
  debug(`deployGenesisReply`)
  // TODO if this is rejected, rollback the whole operation
  return dmz
}
const deployReply = (meta, rxReply, dmz) => {
  // TODO handle rejection of deployment, then roll back the whole operation
  assert.strictEqual(typeof meta, 'object')
  assert(rxReply instanceof RxReply)
  assert(dmz instanceof Dmz)
  const deploy = { ...dmz.meta.deploy }
  debug(`deployReply for:`, deploy[rxReply.identifier])
  assert(deploy[rxReply.identifier])
  delete deploy[rxReply.identifier]

  const { originIdentifier, ...rest } = deploy
  assert.strictEqual(typeof originIdentifier, 'string')
  if (!Object.keys(rest).length) {
    debug(`deploy complete`)
    replyResolve({}, originIdentifier)
    const nextMeta = { ...dmz.meta }
    delete nextMeta.deploy
    return Dmz.clone({ ...dmz, meta: nextMeta })
  }
  const nextMeta = { ...dmz.meta, deploy }
  return Dmz.clone({ ...dmz, meta: nextMeta })
}
export { install, deploy, deployReducer, deployReply, deployGenesisReply }
