const api = require('./src/api')
const hooks = require('./src/hooks')
const readers = require('./src/readers')
module.exports = { ...api, ...hooks, ...readers }
