const assert = require('assert')
const { rxReplyModel, dmzModel, covenantIdModel } = require('../../w015-models')
const { spawn, spawnReducer } = require('./spawn')
const { interchain, isReplyFor, replyResolve } = require('../../w002-api')

const install = (installer) => ({
  type: '@@INSTALL',
  payload: { installer },
})
const deploy = (installer) => ({
  type: '@@DEPLOY',
  payload: { installer },
})
const deployReducer = async (dmz, action) => {
  const { installer } = action.payload
  // TODO assert there is only one deployment action, from parent, and after genesis
  // TODO check format of payload against schema
  // TODO check top level matches this current state
  // TODO clean up failed partial deployments ?

  const { children: topChildren = {} } = installer
  // TODO try make promises that work on a specific action, so can run in parallel
  for (const installPath in topChildren) {
    let { children, covenant, ...spawnOptions } = topChildren[installPath]
    covenant = covenant || 'unity'
    const covenantId = covenantIdModel.create(covenant)
    spawnOptions = { ...spawnOptions, covenantId }
    const genesisSeed = 'seed_' + installPath
    const spawnRequest = spawn(installPath, spawnOptions, [], genesisSeed)
    const network = await spawnReducer(dmz, spawnRequest)
    // TODO make spawn not require dmz to be cloned like this
    dmz = dmzModel.clone({ ...dmz, network })
    const deployAction = deploy(topChildren[installPath])
    interchain(deployAction, installPath)
  }
  // promise is made within spawnReducer
  return dmz.network
}

const deployReply = (network, reply) => {
  // TODO handle rejection of deployment
  assert(rxReplyModel.isModel(reply))

  const aliases = network.getResolvedAliases()
  let outstandingDeploy
  for (const alias of aliases) {
    const channel = network[alias]
    if (channel.systemRole !== './') {
      continue // TODO block all activity until deploy completes
    }
    const deployRequest = channel.requests[1]
    if (!deployRequest || deployRequest.type !== '@@DEPLOY') {
      continue // deployment must have completed
    }
    if (outstandingDeploy) {
      return
    }
    outstandingDeploy = deployRequest
  }
  const isReplyValid = isReplyFor(reply, outstandingDeploy)
  assert(isReplyValid, `action was not round among any deploy replies`)

  const parent = network['..']
  // TODO compare against installer
  // TODO assert only one deploy in the queue
  for (const index of parent.getRemoteRequestIndices()) {
    const request = parent.rxRequest(index)
    if (request.type === '@@DEPLOY') {
      replyResolve({}, request)
    }
    if (request.type === '@@INSTALL') {
      replyResolve({}, request)
    }
  }
}
module.exports = { install, deploy, deployReducer, deployReply }
