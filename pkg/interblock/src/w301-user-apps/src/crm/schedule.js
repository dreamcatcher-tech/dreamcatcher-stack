/**
 * The covenant of the Schedule component.
 *
 * There are two types of schedule:
 * 1. Virtual
 * 2. Dispatched
 * 3. Reconciled
 *
 * Future is generated for any
 */

const api = {
  freeze: {
    type: 'object',
    title: 'DISPATCH',
    description: `Takes the current list of customers, takes a snapshot, and stores it in a child.  This will allow the manifest to be printed, and then reconciled.  It may be undispatched`,
  },
  unfreeze: {
    type: 'object',
    title: 'UNFREEZE',
    description: `Thaws a previously frozen schedule.`,
  },
}
