import React from 'react'
import { Manifest } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const { crm } = apps
const runDate = '2022-11-09'
const complex = crm.utils.generateManifest(crm.faker, runDate)

export default {
  title: 'Manifest',
  component: Manifest,

  args: {
    expanded: true,
    complex,
  },
}

const Template = (args) => {
  Debug.enable('*CollectionList *Manifest crm:utils *InnerCollection')
  return <Manifest {...args} />
}

/**
 * How would Sechdule generate a virtual manifest ?
 *    Filter the sectors to date, then filter the customers to date
 *    Manifest then smooshes all the sectors together to form rows
 *
 * How would a new manifest be generated and saved ?
 *    When schedule covenant is told to add( runDate ) it creates a
 *    manifest child, which uses the same code used to generate the
 *    virtual manifest, saves the results inside itself, and creates a
 *    non-updating hardlink to the approot to lock the manifest in place.
 *
 *    Then when user or sector is viewed from the manifest point of view,
 *    it shows the current version if no different, or the locked version
 *    with a graphical indication of the differences.
 *
 * The manifest display would always receive a complex.  The UI display is
 * ignorant of whether it is virtual or real.
 */

export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
export const Expanded = Template.bind({})
export const Empty = Template.bind({})
const empty = {
  ...complex.state,
  formData: { ...complex.state.formData, rows: [] },
}
Empty.args = { complex: complex.setState(empty) }
export const Published = Template.bind({})
Published.args = {
  complex: complex.setState({
    ...complex.state,
    formData: { ...complex.state.formData, isPublished: true },
  }),
}
export const Reconciled = Template.bind({})
Reconciled.args = {
  complex: complex.setState({
    ...complex.state,
    formData: {
      ...complex.state.formData,
      isPublished: true,
      isReconciled: true,
    },
  }),
}
