const api = require('./src/api')
const hooks = require('./src/hooks')
module.exports = { ...api, ...hooks }
