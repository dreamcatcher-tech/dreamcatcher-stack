const { covenantIdModel } = require('../w015-models')

const { crm } = require('./src/crm')
crm.covenantId = covenantIdModel.create('crm')

module.exports = { crm }
