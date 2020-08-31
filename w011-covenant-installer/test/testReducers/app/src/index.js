const dedupe = require('dedupe')

const reducer = (arr) => dedupe(arr)

module.exports = { reducer }
