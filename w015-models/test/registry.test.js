const fs = require('fs')
describe.skip('registry', () => {
  test('loaded models matches filesystem', () => {
    const _models = require('../')
    const models = { ..._models }
    delete models.registry
    const modelsDir = fs.readdirSync(__dirname + '/../src/models')
    const eventsDir = fs.readdirSync(__dirname + '/../src/events')
    const types = [...modelsDir, ...eventsDir]
    const noSuffix = types.map((file) => file.substring(0, file.length - 3))
    const modelNames = Object.keys(models)
    const modelFiles = noSuffix
    const missingFiles = []
    modelNames.forEach((modelName) => {
      if (!modelFiles.includes(modelName)) {
        missingFiles.push(modelName)
      }
    })
    const missingModels = []
    modelFiles.forEach((filename) => {
      if (!modelNames.includes(filename)) {
        missingModels.push(filename)
      }
    })

    if (missingFiles.length || missingModels.length) {
      throw new Error(
        `Missing Files: ${missingFiles} \nMissing Models: ${missingModels}`
      )
    }
  })
  test.todo('no transient models have a title, so they cannot be inflated')
})
