/**
 * Functions to handle branching and merging.
 * Copy git for terminology and edge case coverage                                                          
 * Forks can only happen if a parent is configured to allow forks 
 *  Something at the top level has to absorb and track all the forks

* ? how to flick between branches in an object and branches in a tree ?                                       
*** eg: wish may have branched, but also the project may have branched too                                    
* ? how to view branches ?                                                                                    
*** want to switch to a branch and treat it like it is the real item ?                                        
* ? who pays for branches ?                                                                                   
* tracking changes - keeps the branch in live system with the parent                                          
* requirements                                                                                                
*** allow submissive merges, where the incoming merge overwrites the target, or vice versa                    
*** error on incompatible merges, where something like covenant type would have been changed ?                
*** allow executing on the @@PR action to see if the target would accept the merge anyway                     
*** allow merge where the source keeps going, or also make it be terminus                                     
***** terminus would need that object to be willing as well                                                   
*** UI components that change color based on merge status of chains                                           
*** permit cross communication across branches by using weak links        
*/

const config = {
  services: {
    branch: async (context, event) => {
      // [target] [destination] --noChildren --deep --track --terminus --silent
      //  deep means also fork all the children too, rather than keeping things shallow
      //  --track means the fork will keep merging in any changes from the parent
      //  these may be forceful, and overide anything local, or they may flag as conflicted if required
      //  --silent means parent is not advertized of the fork
      // rm - used to delete a branch
    },
    merge: async (context, event) => {
      //  merge [target] [incoming1,...] --noChildren --stateOnly --softMerge --terminus
      //  soft means it will allow differences such as action order or other things to be changed
    },
    diff: async (context, event) => {
      const { target, dest, noChildren = false } = event.payload
      // [target] [dest] --noChildren
      // no children ignores treating the diff like a filetree comparison
    },
    pullRequest: async (context, event) => {
      const { target, destination } = event.payload
      // creates a PR object at the nearest outbox ?
      // not sure what an outbox is, but some means of communicating
      // requires network enabled
    },
    switch: async (context, event) => {
      // switch newBranch
      // switch the current root object to be
    },
    list: async (context, event) => {
      const { target = '.' } = event.payload
      // list all the branches for a given target
      // if none, will walk up to the nearest parent that has branches on it
    },
    pull: async (context, event) => {
      // take changes from the origin and merge them in to the current branch
    },
    reset: async (context, event) => {
      // discard all changes to the project ?
    },
    tag: async (context, event) => {
      // mark a particular project blockheight with some significance
      // perhaps could be when an output file reached a certain version
    },
  },
}
const actionSchemas = {
  branch: {
    title: 'branch', // could be given by the key in the schema object ?
    description: '',
    type: 'object',
    required: ['type', 'payload'], // same for all actions tho ?
  },
}

const partialSchema = {
  title: 'Partial Action Schema',
  description: `Shorthand for producing full actionSchemas by removing the
    repetitive parts`,
  type: 'object',
  required: [],
  properties: {
    // every property is considered a property of the payload
  },
}
const generateActionSchema = (partial) => {}
