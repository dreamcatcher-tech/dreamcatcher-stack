const { covenantIdModel } = require('../w015-models')
const shell = require('./src/shell')
shell.covenantId = covenantIdModel.create('shell')

const hyper = require('./src/hyper')
hyper.covenantId = covenantIdModel.create('hyper')

const unity = { reducer: (state = {}) => state }
unity.covenantId = covenantIdModel.create('unity')

module.exports = { shell, unity, hyper }
