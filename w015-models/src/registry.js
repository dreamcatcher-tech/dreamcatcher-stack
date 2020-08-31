const container = {}
const registry = {
  registerModels(models) {
    // console.log(`Model count: ${Object.keys(models).length}`)
    Object.keys(models).forEach((key) => {
      const model = models[key]
      if (!key || !models[key]) {
        throw new Error(`${key} passed in as undefined`)
      }
      const title = model.schema.title
      if (container[title]) {
        throw new Error(`${title} was already registered`)
      }
      container[title] = model
    })
  },
  isRegistered(title) {
    return !!container[title]
  },
  get(title) {
    if (!container[title]) {
      throw new Error(`Model not found in registry: ${title}`)
    }
    return container[title]
  },
  _getContainer: () => container,
}

module.exports = { registry }
