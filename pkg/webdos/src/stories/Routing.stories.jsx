import React from 'react'
import { Routing } from '..'
import delay from 'delay'
import Debug from 'debug'
const debug = Debug('Routing')

export default {
  title: 'Routing',
  component: Routing,
  args: {
    sector: '13',
  },
}

const Template = (args) => {
  Debug.enable('*Routing  *Sorter* *SorterDatum *DatumHOC *Datum')
  const [complex, setComplex] = React.useState(args.complex)
  if (complex === args.complex) {
    const network = args.complex.network.map((child) => {
      const { path } = child
      const set = async (formData) => {
        debug('set', path, formData)
        await delay(1200)
        debug('setting done', path)
        setComplex((current) => {
          const network = current.network.map((child) => {
            if (child.path === path) {
              return { ...child, state: { ...child.state, formData } }
            }
            return child
          })
          return current.setNetwork(network)
        })
      }
      return { ...child, actions: { set } }
    })
    setComplex(args.complex.setNetwork(network))
  }
  debug('complex', complex)
  args = { ...args, complex }
  return <Routing {...args} />
}

export const Blank = Template.bind({})
export const Small = Template.bind({})
export const Medium = Template.bind({})
export const Large = Template.bind({})
