/**
 * How to use the Standard Engine in the four contexts:
 * 
 * 
const aws = {
  // make versions for each stream processor
  // hook the input and output queues of the particular stream processor
  // hook every other queue with an exception if something moves
}

const client = {
  // hook push to sqsIncrease queue, for actionless reduce
  // tap consistency to get the first block created, so have address
  // hook ioIsolate queue to pierce the reducer
  // later hook crypto queue to make own keys
  // later hook consistency to allow restarts, maybe
}

const emulator = {
  // hook ioIsolate queue to live load reducers
  // hook rx & tx to interact with client
  // hook ioConsistency to persist between reloads
}

const sideEffects = {
  // hook ioIsolate queue to piece the reducer
  // hook push to sqsIncrease queue, for actionless reduce
}

*/

export * from './src/effectorFactory'
export * from './src/awsFactory'
