const sodium = require('./src/sodium')
const common = require('./src/common')
module.exports = { ...sodium, ...common }
