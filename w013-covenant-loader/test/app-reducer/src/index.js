const decamelize = require('decamelize')

const myReducer = (string) => decamelize(string)

module.exports = { reducer: myReducer }
