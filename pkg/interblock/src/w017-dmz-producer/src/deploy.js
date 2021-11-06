import assert from 'assert-fast'
import {
  rxReplyModel,
  dmzModel,
  covenantIdModel,
  rxRequestModel,
} from '../../w015-models'
import { spawn, spawnRequester } from './spawn'
import { interchain, replyResolve, replyPromise } from '../../w002-api'
import Debug from 'debug'
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
  assert(dmzModel.isModel(dmz))
  assert(!dmz.meta.deploy)
  assert(rxRequestModel.isModel(action))
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
  const meta = { ...dmz.meta }
  const height = dmz.getCurrentHeight()
  if (Object.keys(directChildren).length) {
    replyPromise()
    meta.deploy = { originIdentifier: action.identifier }
  }
  for (const installPath in directChildren) {
    let {
      children,
      covenant,
      state = {},
      ...spawnOptions
    } = directChildren[installPath]
    covenant = covenant || 'unity'
    const covenantId = covenantIdModel.create(covenant)
    spawnOptions = { ...spawnOptions, covenantId, state }
    const spawnRequest = spawn(installPath, spawnOptions)
    const [nextDmz, spawnId, alias, chainId] = spawnRequester(dmz, spawnRequest)
    assert(!meta[spawnId])
    meta[spawnId] = { type: '@@DEPLOY_GENESIS', alias }
    dmz = nextDmz
    const secondRequestIndex = 1
    const deployId = `${chainId}_${height}_${secondRequestIndex}`
    const deployAction = deploy(directChildren[installPath])
    interchain(deployAction, installPath)
    assert(!meta[deployId])
    meta[deployId] = { type: '@@DEPLOY' }
    assert(!meta.deploy[deployId])
    meta.deploy[deployId] = alias
  }
  return dmzModel.clone({ ...dmz, meta })
}
const deployGenesisReply = (meta, rxReply, dmz) => {
  assert.strictEqual(typeof meta, 'object')
  assert(rxReplyModel.isModel(rxReply))
  assert(dmzModel.isModel(dmz))
  debug(`deployGenesisReply`)
  // TODO if this is rejected, rollback the whole operation
  return dmz
}
const deployReply = (meta, rxReply, dmz) => {
  // TODO handle rejection of deployment, then roll back the whole operation
  assert.strictEqual(typeof meta, 'object')
  assert(rxReplyModel.isModel(rxReply))
  assert(dmzModel.isModel(dmz))
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
    return dmzModel.clone({ ...dmz, meta: nextMeta })
  }
  const nextMeta = { ...dmz.meta, deploy }
  return dmzModel.clone({ ...dmz, meta: nextMeta })
}
export { install, deploy, deployReducer, deployReply, deployGenesisReply }
