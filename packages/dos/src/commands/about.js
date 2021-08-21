import Chalk from 'ansi-colors'
import cliui from 'cliui'
const object = Chalk.bold.yellow('Object')
const link = Chalk.bold.yellow('Link')
const covenant = Chalk.bold.yellow('Covenant')
const stateMachine = Chalk.bold.yellow('StateMachine')
const os = Chalk.bold.yellow('DistributedOperatingSystem')
const fs = Chalk.bold.yellow('FileSystem')
const app = Chalk.bold.yellow('App')

export const about = async () => {
  const ui = cliui()
  ui.div(`Everything in this ${os} is a Blockchain ${object}`)
  ui.div()
  ui.div(
    { text: `1.`, width: 4 },
    `${object}s exist everywhere independent of any single computer because they are virtual, and not tied to a particular machine, freeing them from the faults of nature which plague physical hardware`
  )
  ui.div(
    { text: `2.`, width: 4 },
    `${object}s can connect to each other to transfer instructions or payload data via ${link}s.`
  )
  ui.div(
    { text: `3.`, width: 4 },
    `The logic governing the behaviour of ${object}s is inside a ${covenant}`
  )
  ui.div(
    { text: `4.`, width: 4 },
    `A subclass of ${covenant} is a ${stateMachine}`
  )
  ui.div(
    { text: `5.`, width: 4 },
    `In our system, ${object}s are only changed internally by ${stateMachine}s`
  )
  ui.div(
    { text: `6.`, width: 4 },
    `When viewed as a Graph, the ${link}s between all ${object}s are the ${fs}`
  )
  ui.div(
    { text: `7.`, width: 4 },
    `The ${fs} is arranged in a hierarchy from a root, so that it looks like a POSIX filesystem for the familiarity of our users`
  )
  ui.div(
    { text: `8.`, width: 4 },
    `When viewed as executables, the collection of ${stateMachine}s are the ${app}s of our ${os} `
  )
  ui.div(
    { text: `9.`, width: 4 },
    `Including the ${app} named the Dreamcatcher means we by default include the ${app} that coordinates Talent into making more ${app}s`
  )
  ui.div()
  ui.div(`type 'help' for a list of commands`)
  ui.div()
  return { out: ui.toString() }
}

const help = `Information about the HyperNet`
