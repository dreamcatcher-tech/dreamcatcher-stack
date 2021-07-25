const fromFunctions = (consistencySource) => async (action) => {
  switch (action.type) {
    case 'PUT_SOCKET':
      return consistencySource.putSocket(action.payload)
    case 'GET_SOCKETS':
      return consistencySource.getSockets(action.payload)
    case 'DEL_SOCKET':
      return consistencySource.delSocket(action.payload)
    case 'POOL':
      return consistencySource.putPoolInterblock(action.payload)
    case 'LOCK':
      return consistencySource.putLockChain(action.payload)
    case 'UNLOCK':
      return consistencySource.putUnlockChain(action.payload)
    case 'LINEAGE':
      return consistencySource.getLineage(action.payload)
    case 'ANY_AFFECTED':
      return consistencySource.getIsAnyAffected(action.payload)
    case 'AFFECTED':
      return consistencySource.getAffected(action.payload)
    case 'IS_PRESENT':
      return consistencySource.getIsPresent(action.payload)
    case 'GET_BLOCK':
      return consistencySource.getBlock(action.payload)
    case 'PIERCE_REQ':
      return consistencySource.putPierceRequest(action.payload)
    case 'PIERCE_REP':
      return consistencySource.putPierceReply(action.payload)
    default:
      throw new Error(`Unknown action type: ${action && action.type}`)
  }
}

const toFunctions = (queue) => ({
  putSocket: (payload) => queue.push({ type: 'PUT_SOCKET', payload }),
  getSockets: (payload) => queue.push({ type: 'GET_SOCKETS', payload }),
  delSocket: (payload) => queue.push({ type: 'DEL_SOCKET', payload }),
  putPoolInterblock: (payload) => queue.push({ type: 'POOL', payload }),
  putLockChain: (payload) => queue.push({ type: 'LOCK', payload }),
  putUnlockChain: (payload) => queue.push({ type: 'UNLOCK', payload }),
  getLineage: (payload) => queue.push({ type: 'LINEAGE', payload }),
  getIsAnyAffected: (payload) => queue.push({ type: 'ANY_AFFECTED', payload }),
  getAffected: (payload) => queue.push({ type: 'AFFECTED', payload }),
  getIsPresent: (payload) => queue.push({ type: 'IS_PRESENT', payload }),
  getBlock: (payload) => queue.push({ type: 'GET_BLOCK', payload }),
  putPierceRequest: (payload) => queue.push({ type: 'PIERCE_REQ', payload }),
  putPierceReply: (payload) => queue.push({ type: 'PIERCE_REP', payload }),
})

module.exports = { toFunctions, fromFunctions }
