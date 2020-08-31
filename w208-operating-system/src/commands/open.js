const { prompt } = require('enquirer')
const open = require('better-opn')
module.exports = async (ctx, url) => {
  debug(`open: `, url)
  await open('https://aws.amazon.com/cognito/')
}
