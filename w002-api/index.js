const api = require('./src/api')
const hooks = require('./src/hooks')
const queries = require('./src/queries')
module.exports = { ...api, ...hooks, ...queries }
