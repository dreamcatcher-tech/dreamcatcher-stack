import assert from 'assert-fast'
export default class Complex {
  static create({ state, binary, network, actions, isLoading, wd, tree }) {
    return new Complex({ state, binary, network, actions, isLoading, wd, tree })
  }
  constructor({ state, binary, network, actions, isLoading, wd, tree }) {
    this.state = state || {}
    this.binary = binary
    this.network = network || []
    this.actions = actions || {}
    this.isLoading = isLoading || false
    this.wd = wd || '/'
    this.tree = tree
    if (tree === undefined) {
      this.tree = Complex.create({ ...this, tree: false })
    }
  }
  clone() {
    return new Complex(this)
  }
  addAction(actions) {
    const next = this.clone()
    next.actions = { ...next.actions, ...actions }
    return next
  }
  setWd(wd) {
    assert.strictEqual(typeof wd, 'string')
    assert(wd.startsWith('/'))
    const next = this.clone()
    next.wd = wd
    return next
  }
  child(path) {
    assert.strictEqual(typeof path, 'string')
    assert(!path.startsWith('/'))
    assert(!path.startsWith('./'))
    assert(!path.startsWith('..'))
    const child = this.network.find(({ path: p }) => p === path)
    if (!child) {
      throw new Error(`child not found: ${path}`)
    }
    const { tree } = this
    return Complex.create({ ...child, tree })
  }
  hasChild(path) {
    assert.strictEqual(typeof path, 'string')
    assert(!path.startsWith('/'))
    assert(!path.startsWith('./'))
    assert(!path.startsWith('..'))
    return this.network.some(({ path: p }) => p === path)
  }
  rm(path) {
    assert(this.hasChild(path))
    const next = this.clone()
    next.network = next.network.filter(({ path: p }) => p !== path)
    return next
  }
  setNetwork(network) {
    assert(Array.isArray(network))
    const next = this.clone()
    next.network = network
    return next
  }
}
