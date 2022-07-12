const reducer = (request) => {
  if (request.type !== '@@INIT') {
    throw new Error(`Covenant was sent request: ${request.type}`)
  }
}

export { reducer }
