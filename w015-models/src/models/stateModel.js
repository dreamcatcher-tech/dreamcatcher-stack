const { standardize } = require('../utils')
const { assertNoUndefined } = require('../assertNoUndefined')

const schema = {
  title: 'State',
  description: `The result of running a covenant is stored here.
It checks the state minus the actions is serializable
Includes the array of requests and replies returned from 
reducing the covenant.  These actions are intended to be transmitted
via the network.  This model enforces the format and logic of the
returns from the reducer

This is how covenant info is ingested back into the trusted system.
It is crucial that the format of this data is correct

Entry point from covenant to system.

Maximally inflates actions with defaults.  Logical checking is done inside
the networkProducer as needs context of the initiating action to fill in
remaining defaults

The actions in from the covenant are refined over three states:
1. create( state ) inflates actions to pass schema validation
2. logicize( state ) checks static logic
3. networkProducer.tx( state ) checks context logic

The returned model is forbidden to have an actions key on it.
The validation is run during clone, then logicize strips the actions out.

Create is only called immediately after a reducer call returns some state.
Therefore, we always know what the default action is, so we require it of create.
`,

  type: 'object',
  required: [],
}

const stateModel = standardize({
  schema,
  create(state = {}) {
    assertNoUndefined(state)
    return stateModel.clone(state)
  },
  logicize(instance) {
    assertNoUndefined(instance)
    // TODO ensure no functions attempted to be stored ? or just blank them between blocks ?
    return {}
  },
})

module.exports = { stateModel }
