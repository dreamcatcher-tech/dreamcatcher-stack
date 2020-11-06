const api = require('./src/api')
const promises = require('./src/promises')
module.exports = { ...api, ...promises }
