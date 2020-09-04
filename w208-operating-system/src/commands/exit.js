module.exports = function exit({ spinner }) {
  if (spinner) spinner.stop()
  process.exit()
}

module.exports.help = `Exit the current program`
