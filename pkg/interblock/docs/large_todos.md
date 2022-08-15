## Binary layer

There is a slot designed for this in the continuation Models (ie: Request and Reply) but how the user interacts with this layer has not been defined

### How to reinflate ?

Probably need to supply some api function to the user so that they can inflate within the reducer.
Permissions must be considered to not allow them to inflate something they should not have access to.

### How to receive back a json response and a binary response ?

If I make a request to a foreign chain, it should be able to send back both a json response as well as some binary data, and I need a way to demux those two inside the reducer.

## Scaling

We must be able to run the IPFS node in a service worker in the browser, so that the application can be open in multiple tabs without contention. Also in Nodejs, speed can be had by running multiple engines concurrently.

## IPFS ORM

The crush system of `w008-ipld` can be factored out into a standalone package that can be used to construct a generate ORM backed by IPFS. This is good for our system because having a generalization will be more likely correct under all usage, and if others reuse the package they can carry some of the code burden.

This should be able to do checks against a supplied schema, as well as inflate and deflate the user classes as required.

Optimization of inflation methods is more likely to be achieved using a generic system than a specialized one.

Further, this ORM can be used to implement an object cache, where hydrated objects are kept in ram, subject to memory pressure, further enhancing performance.

Crush should cache its results, so calling multiple times on the same object only loads the cpu initially.

This should support an encryption layer, where each CID is encrypted, and then linked to its parent. This keeps all CIDs as a hash of encrypted data, so zero information is available without the encryption key, except for the fact that the root node exists. All CIDs within the root node would be encrypted too, and so be unwalkable without the key.

## Speculative execution on client side

Rather than waiting for any given validator set to respond, we should be able to execute what the validators would have computed on the client side and carry on with this speculative result. This will give true offline capability.

To do this, we need a form of "state by assertion" which deviates from the current action model of state transitions. Basically saying `state` as opposed to `state + action = state'`. There is nothing wrong with this assertion style update - all that matters is that everyone agrees on it. We may trace who proposed the change. The assertion style is not so different from the action style - nobody seems to question too much where the aciton came from, it is just asserted into existence, so doing the same thing but without the action first seems a simpler proposition.

## Defining the DOS Framework

Our application design model has some rather specific conventions that we need to document and justify somewhere. We also include in this framework the means by which a pool of workers can be found to build the software, how funding can be attracted for that work, and how dispersals of the purchases made by buys is balanced between all contributors.
