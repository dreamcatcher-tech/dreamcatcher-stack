const api = {
  // rm covers removing the manifest
  // rm is blocked if it has been reconciled
  reconcile: {
    description: `modify the reconciled state of the manifest.  May be performed multiple times before finalization`,
  },
  finalize: {
    description: `Manifest is fully reconciled, send out the emails to people, and deduct money from account balances`,
  },
}
