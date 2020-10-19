const piercerFactory = (effector) => {
  // takes in actions that return promises that resolve with results
  // io write to the pierce queue
  const promises = new Map()
  const id = uuid()
  let dispatchCounter = 0

  return async ({ type, payload, to }) => {
    const _dispatchId = `${dispatchCounter++} ${id}`
    debug(`injector: %s to: %s id: %o`, type, to, _dispatchId)
    payload = { ...payload, _dispatchId }
    const action = request(type, payload, to)
    const promise = generateDispatchPromise(action)
    dispatches.push(action)
    await Promise.resolve()
    return promise
  }

  const setDispatchPromise = (request) => {
    const promise = {}
    // TODO remove pending promises
    const settled = new Promise((resolve, reject) => {
      promise.settled = { resolve, reject }
    })
    settled.pending = new Promise((resolve, reject) => {
      promise.pending = { resolve, reject }
    })
    promises.set(request, promise)
    return settled
  }
}
