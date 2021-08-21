import process from 'process'
export const exit = ({ spinner }) => {
  if (spinner) spinner.stop()
  process.exit()
}

const help = `Exit the current program`
