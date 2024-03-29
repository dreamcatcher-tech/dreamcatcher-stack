## API

These methods are supplied to Covenant authors to interact with the chain system. The system reducer uses these same methods to implement all the system functionality as well.

### `async useBlock( ?path ) => Block`

Fetch the latest block at the specified path. Defaults to self. Used by the DMZ functions to perform system actions.

### `async useLockedState( ?path ) => [ state, async setState( ?state' ) ]`

Lock the state at the remote path, returning the current state and providing a function that can be used to unlock the state whilst optionally updating it. Guarantees exclusive use of the state. Note that this will cause a new block to be formed on the remote chains if lock is granted. This design allows a chain to hold multiple disparate locks across different chains in order to perform an atomic update of all of them.

### `async useState( ?path ) => [ state, async setState( state ) ]`

The clobbering non-exclusive version of useLockedState. Gets the current state, does not guarantee that it has not been modified by the time setState is called. Will clobber the state if it was updated some time between reading and writing. Advantage is that it does not cause a write to the target if only reading the state.

### `async interchain( request, ?path ) => ( resolve | reject )`

Requests to other chains, including to self. Result is the return value of executing the target reducer.

### `async effect( type, fn, ...args ) => ( resolve | reject )`

Side effects that can do anything at all. Type is required as a friendly name, nothing else. `fn` is a function that will be executed with `...args` in the isolated context that the reducer is currently running in.  Different access controls can be set on different isolated contexts, and so in this way side effects can be leaked to the outside world precisely.

Idea is that in total isolation, the effects are simply ignored, but when it has some freedom, rerunning the pulse would cause the effect function to run.

Possibly this can have signature `useEffect( fn, [deps])` just like react.  The effect would be rerun when any of the args changed.  This would require some background accounting to store references in a slot on the block.  This makes triggering the effect easier, since the same result can be done with the `effect( fn )` signature.  This accounting might only need to be done by the isolation context, not the actual block.

Using dependencies makes it easy to run a function whenever it first mounts on an isolator.  Also maybe makes it possible to send actions back into the chain, since we can have `setState()` access inside the function closure.

? how can an effect pierce something back into the chain ?

eg: an API call.  
```js
const result = await usePromise(() => api.call(arg1, arg2))
```
This is a compromise between full blown react like effects with dependencies, and a simple promise based interface to make a single external call.  Generators would need a similar interface.

### `async useLockedBinary( ?path, ?start, ?length ) => [ binary, async setBinary( ?binary', ?start, ?length ]`

Exclusively access binary data assosciated with a given chain, with optional start and length to get a narrowed slice of the data. Unlock it using setBinary(). It is an error to attempt to set on a range outside of that for which the lock was granted for.

### `async useBinary( ?path, ?start, ?length ) => ( binary, async setBinary( ?binary', ?start, ?length )`

The clobbering non-exclusive version of useLockedBinary.

### `replyBinary( binary, ?payload ) => Object`

In order to respond with a binary object, we need to use a hooked function to provide this object that is recognized as part of the payload layer. We might opt to exclude this and allow any IPFS object in the return value, but for now any object that is returned will be treated as a POJO unless it was returned using this function as its factory.

## Reducer Signature

On the backend, the signature is (roughly - needs improvement):

> `( state, request, resolvedRequests[] ) => ( state', requests[], reply )`

The reply may be either resolved, rejected, or promised, indicating that the function needs to continue running after all of its requests are resolved.

It is an error to send back a promise but no new requests, as this state can never settle.

Reply is the return value of the function, and may be an empty object for returning `undefined`, or if the function throws, it is a rejection. If the function returns a promise, then the reply object is a promise also.

state' is technically sent back via requests, and so the front end signature is:

> `( request, resolvedRequests[] ) => ( requests[], reply )`

## Backend Implementation

All these functions are implemented via system actions to the loopback address. Upon receipt, the engine recognizes they are a request for information outside of the chain, and so begins the process of resolving the requested information. The responses to these requests are then turned into reply form, and inserted into the chain again, to be processed like any other request would be.

Using loopback means the lookup process can be frozen at any time if taking too long and a new block made, with the operation continuing in the next block.

`useBlock` and `useState` are reader functions, whose purpose is to read from the blocks of other chains and insert those results back in to the executing current block. Such reading is always relative to the root chain, so that consistency and repeatability is assured.

## Frontend Implementation

Whenever an api call is made, our code does a stacktrace on it, and looks for the special name assigned to a containing function that ran this instance of the user supplied code. Upon finding its hook, it looks up any previously resolved requests, and if none are found, makes a new request that will be returned at the end of the function execution.

## Todos

### `async useBlockHeight( ?path, ?height, ?count ) => Blocks[]`

Currently no ability is given to read from any blocks other than latest. Block heights might be removed as a feature, so this functionality would need to be implemented as a relative height. Given a specific block hash, then a relative height could be requested. Note that asking for the next block has no meaning, as the current block is a matter of perspective. To get the next block from a current perspective, you must get the latest known block and then ask for the next one after that.

### `async useFind( pathPattern, stateQuery ) => results[]`

Takes a Mango query and returns results. Might be replaced by GraphQL query. Should handle streaming back results as they become available. Should be subscribable to so that results that do not exist yet can be sent back.

### `async useBlockbuster() => void`

End the current block, and immediately begin executing again. Different to useTimeout(0) because it is internal only and does not do anything external. Similar to `yield` in some multi threaded languages. Most useful to cause the transmissions to begin, as these only occur once the block is signed.

### `async useTimeout( ms ) => void`

Break the current block, then return after at least delayMs milliseconds. We might require that this contact a service to get a reply after said delay, or it might be up to the validators to monitor the chain and trigger when the time is appropriate, storing the request in state.

## Unknowns

1. How should binary items be sent and received / reinflated
1. How to specify ranges of binary for recovery
1. Can we represent a whole chain as an object and provide api methods on it ?
