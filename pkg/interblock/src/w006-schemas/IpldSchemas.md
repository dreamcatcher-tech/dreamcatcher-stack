# Ipld Schemas for Interpulse

Read the [Guide to IPLD schemas](https://ipld.io/docs/schemas/using/authoring-guide/) to understand the syntax.

Any changes to this file need to be followed by running `yarn schemas` to generate the file `src/w014-schemas/ipldSchemas.js` which is imported by all the Models in `w015-models`

## HAMT

Schemas for the hash array mapped trie used to reduce Network slowness with speed.

```sh
# Root node layout
type HashMapRoot struct {
  hashAlg Int
  bucketSize Int
  hamt HashMapNode
}

# Non-root node layout
type HashMapNode struct {
  map Bytes
  data [ Element ]
} representation tuple

type Element union {
  | &HashMapNode link
  | Bucket list
} representation kinded

type Bucket [ BucketEntry ]

type BucketEntry struct {
  key Bytes
  value Any
} representation tuple
```

## Binary

Special in that it exposes a raw link, but adheres to the model interface for interop with the other models here. Similar to Address in that it exposes an IPLD primitive.

```sh
type Binary link
```

## Address

Special object that wraps an IPLD Link, just like Binary wraps an IPLD Block.
The model includes these constants:

1. UNKNOWN `QmVQEFQi81SSbZaezrm78p333EGeYzfEZyvCnX848KaMCw`
1. ROOT `QmSawJHmTNpaUjDYWCE9RgoHTpKbi6JD7TuGESFbtZ4ZLc`
1. LOOPBACK `Qme2gGBx8EnSrXc5shQF867KPQd4jwubNov67KEKZbo4p3`
1. INVALID `QmYSWwmJ4w1pZ6igGRNKcVHpBU68iaumYEjsdbMpxfAQaj`
1. GENESIS `QmZTKF2kuFHy8isKWXpNeNa5zjeJwsHUbPbTNF1fS8HkpB`

Addresses are always CID version 0, which makes them easy to distinguish at a glance from `Pulse`s and `Binary`s, which are CID version 1.

An address is the version 0 CID that links to the version 1 CID of the first Pulse of a given chain.

```sh
type Address link
```

## Request

Messages for communicating with a reducer.
Requests are always delivered as part of a channel between chains.
These are effectively [Redux](https://redux.js.org) actions, with an addition of an IPLD CID for adding binary data.

```sh
type Request struct {
    type String
    payload { String : Any }
    binary optional Binary
}
```

## Reply

Messages that implement the continuation system.
One of three types. Immediate replies are resolves or rejections too.
Later these types will be extended to implement generators.

```sh
type ReplyTypes enum {
    | REJECT("@@REJECT")
    | PROMISE("@@PROMISE")
    | RESOLVE("@@RESOLVE")
}
type Reply struct {
    type ReplyTypes
    payload { String : Any }
    binary optional Binary
}
```

## Public Key

`key` is the public key from an IPFS PeerID

`PublicKeyTypes` comes from [`js-libp2p-crypto`](https://github.com/libp2p/js-libp2p-crypto/blob/125d33ca7db2b7ef666d1c1425e10827a7555058/src/keys/keys.js#L20)

```sh
type PublicKeyTypes enum {
    | Ed25519
    | Secp256k1
    | RSA
}
type PublicKey struct {
    name String
    key String
    algorithm PublicKeyTypes
}
```

## Validators

```sh
type Validators struct {
    quorumThreshold Int
    publicKeys [&PublicKey]
}
```

## Signatures

An array of signatures as `base36upper` encoded strings that matches the order of the Validators list.
Gaps in the array represent missing signatures, which might still pass quorum.
May be CID'd if space becomes an issue.

```sh
type Signatures [String]
```

## Covenant

The Covenant system uses a PulseChain to represent a code package and its various revisions. This PulseChain may have children to represent subpackages, and may include forks, representing different flavours of release such as beta, dev, and prod.

The PulseChain will include CID links to the git repos that the code was generated from, strengthening the link between running code and committed code.

To determine what packages to load, we need to be told what chainId to look for, and then which specific Pulse in that PulseChain contains the version we will be running. In development mode, we override this lookup by developer supplied functions at runtime, to allow rapid feedback.

Publishing new versions of your code is done by making a new Pulse in the PulseChain. Your software package may be connected to, or listed on an aggregator PulseChain, to allow centralized searching. Permissions and other management concerns are handled with the standard PulseChain methods.

To be a valid Pulse that we can load code from, we need some minimum information in the state, described in the schema below. System covenants are loaded from the chain that they publish from, the same as user supplied covenants, except we shortcut the lookup and load process, and we also skip containment.

We have 3 types of dependencies in the system:

1. Conventional - these are specified using the package manager that your code type uses. Eg: npm, pip, cargo
2. ChainModule - these are pieces of code that are managed by the in chain code publication system. These can be spliced into existing package managers, and represent a hash based reference to a code package and a code executable. In nodejs, an executable is an npm package that has all its modules installed and optionally some transpilation applied. Covenants as dependencies are in this category.
3. ChainInstance - this is a reference to a running chain, and is referenced by chainId. These can be oracles, services, people, or any other object in the chain based multiverse.

```sh
type PackageTypes enum {
    | javascript
    | javascript_xstate
    | python
    | go
    | rust
    | haskell
    | c
    | cpp
}
type PackageState struct {  # Basically package.json excerpts
    name String
    version String
    type PackageTypes
}
type Covenant struct {
    address Address
    pulse PulseLink
    info &PackageState      # Link to the info in the Pulse
    package Binary          # link to the binary of the Pulse
}

```

## Timestamp

Date example `2011-10-05T14:48:00.000Z`

```sh
type Timestamp struct {
    isoDate String     # ISO8601 standard string
}
```

## ACL

Will contain a list of what groups have access to what paths, and what actions they can use at those paths. Then, a list of users to groups. Basically copying Linux, so chmod permissions will be stored with the chains rather than in a central list.

```sh
type ACL struct {
    # ACL will be done in a future revision
}
```

## State

CID links inside the State will allow the author to break down their state any way they please. This will not be supported initially, as the State should be kept small enough to be managed as a single object.

The result of running a covenant is stored here, and must be serializable.

State is special in that it wraps an object directly, with no predefined keys.

```sh
type State { String : Any }
```

## Meta

A storage area used to track information used by the system as it manages its own chain and the interactions with other chains. Eg: used to track genesis actions so it knows which action to reply to.

```sh
type Meta struct {
    replies { String: { String : Any }}
    deploy { String : Any }     # track ongoing deploy operations
}
```

## Pending

Tracks what was the covenant action that caused the chain to go into pending mode, stored by channelId and requestId. It then keeps track of all requests made while the chain is in pending mode whenever the covenant is run. The chain is only rerun once replies have been received that settle all the outbound requests, to avoid wasteful rerunning.

Each rerun must produce the exact same requests each time, in the exact same order.

This structure consists of two arrays - one of all the outbound requests the covenant made, and another of all the so far received replies. The reducer should not be invoked until all the empty slots in the `replies` array have been filled.

```sh
type RequestId struct {
    channelId Int
    requestId Int
}
type PendingRequest struct {
    request &Request
    to String                   # Alias at time of invocation
    id optional RequestId       # Not known at time of creation
}
type Pending struct {
    rxPendingRequest RequestId    # The request that triggered pending mode
    requests [PendingRequest]
    replies [&Reply]
}
```

## Config

Entropy is a seed used to provide pseudorandomness to the chain. Initially it is used to ensure the genesis blocks are strongly unique, but every time a function requests some random data, we increment the count, then run a twister function that many times to generate the randomness. The count is zeroed each Pulse by storing the current value of the twister. If the covenant is pending, this count is not increased, but rather the count in Pending slice is increased temporarily.

```sh
type SideEffectsConfig struct {
    networkAccess [String]
    asyncTimeoutMs Int
}
type Entropy struct {
    seed String
    count Int
}
type Config struct {
    isPierced Bool
    sideEffects SideEffectsConfig
    isPublicChannelOpen Bool    # May be list of approots
    acl &ACL
    interpulse &Covenant        # What version of Interpulse is this built for
    entropy Entropy
    covenant &Covenant
}
```

## Dmz

The Pulse structure is required to be both the snapshot of a stable state and a working object used to pool with and process with. When in pooling mode, it must be additive, in that if a block was begun with one version of the pool, using IPFS to determine what the diff of the next pool should allow a new blocking effort to begin without any backtracking.

An example of where such backtracking might occur if designed poorly is in the induction of Pierce actions. As these are put into a virtual channel, each time they are pooled, a new virtual Pulse needs to be created, to permit blocking to have already begun, then carry on immediately using the next pooled DAG.

```sh
type Dmz struct {
    config &Config
    timestamp Timestamp                 # changes every block
    network Network                     # block implies network changed
    state &State
    meta &Meta
    pending optional &Pending
    approot optional PulseLink          # The latest known approot
    binary optional Binary
}
```

## Tx

A transmission that is destined for some chainId, which might be as yet unresolved.  
At the start of each block, all transmitting channels are zeroed and the precedent is updated. Validators may coordinate transmission workloads by sharing the pooled softblock where they each zero out channels as they get sent, to ensure all interblocks are sent, and to parallelize the work.

```js
const TxExample = {
    precedent: CIDPrecedent,
    system: {
        requestsStart: 23423,
        requests: [request1, request2, request3],
        repliesStart: 3324,
        replies: [reply1, reply2, reply3, reply4]
        promisedIds: [ 32, 434, 435 ],
        promisedReplies: [
            { requestId: 12, reply: reply5 },
            { requestId: 9, reply: reply6 }
        ]
    },
    reducer: {
        requestsStart: 84587,
        requests: [],
        repliesStart: 868594,
        replies: [reply1]
        promisedIds: [ 3, 562, 9923 ],
        promisedReplies: []
    }
}
```

```sh
type PromisedReply struct {
    requestId Int
    reply &Reply
}
type TxQueue struct {
    requestsStart Int
    requests optional [&Request]
    repliesStart Int
    replies optional [&Reply]
    promisedIds [Int]
    promisedReplies optional [PromisedReply]
}
type Tx struct {
    precedent optional PulseLink    # The last Pulse this chain sent
    system TxQueue                  # System messages
    reducer TxQueue                 # Reducer messages
}
```

## Rx

After each block is made, tip chain precedents are trimmed to free up memory.
Once Rx is no longer active, trimmed to be nothing.
`RxRemaining` tracks how many actions remain to be processed. Storing only the difference removes the redundancy of storing any cursor information.

```sh
type RxRemaining struct {
    requestsRemaining Int
    repliesRemaining Int
}
type Rx struct {
    tip optional PulseLink          # The last Pulse this chain received
    system optional RxRemaining
    reducer optional RxRemaining
}
```

## Channel

`tip` matches up with precedent on the other side.

Tx and Rx are split out so that they can be stored on the block separately.
Tx needs to be separate so that remote fetching does not expose the channelId.
Rx needs to be separate to allow the ingestion of messages to be halted at any point.
Both are separate from Channel so that the potentially large HAMT that stores
all the Channel instances is updated as little as possible, whilst providing rapid
lookup to get channels that are active.

Tx needs to be hashed as it is an independent transmission, but Rx does not
need to be hashed.

The structure implements the design goal of making the Pulse be the context
of the state machine that processes all the actions.

Channel stores rx and tx only after all the activity has been wrung out of them.

Channel has functions to transmit actions, because it needs to update both tx and rx to shift the next reply to be processed. In contrast, receiving actions is done by calling the rx slice directly, as no modifications occur.

```sh
type Channel struct {
    address Address                 # The remote chainId
    tx &Tx
    rx Rx
    aliases [String]                # reverse lookup
}
```

## Loopback

Subclass of Channel that reverses Tx around on itself.
Loopback is never counted as transmitting, but if it has activity on its Tx slice, it is counted as receiving

```sh
type Loopback = Channel
```

## Network

Every channel is given an index, which is monotonic since the start of the chain.
This ID stays with the channel for its entire lifecycle.
Internally, everything references channels by this id, with the advantage being communications are unaffected by renames or resolving the chainId, and when actions are dispatched, a unique identifier can be given to the action sender regardless of the current point in the lifecycle of the chain.

There may be many aliases mapped to the same channelId.

A HAMT is used to track large amounts of data whilst storing only diffs.

Channel is not stored as a link, but as a full object, since inside of the channel the Tx key will be stored as a link anyway, so no point double linking.

Rxs may use a hamt.

Txs are blanked each block, so no need to use a HAMT.

Uplinks should never include any channels that are in the other hamts.

Constraints:

1. same alias name cannot be in multiple tables
1. remote addresses have exactly 1 channelId
1. uplinks cannot be tranmsitted to

Channel Types

1. children - by alias, bidirectional
1. uplink - by address, the rx side of downlink
1. downlink - by path resolved to address, the tx side of uplink
1. symlink - permanent link by path, resolution refreshed each tx
1. hardlink - permanent link by address, acts as a shared child

This does introduce non-determinism, as the timing of when something occurred can now affect what address it was resolved to.

```sh
type Channels struct {
    counter Int
    list HashMapRoot               # Map of channelIds to Channels
    addresses HashMapRoot          # reverse lookup of channels
    rxs [ Int ]
    txs [ Int ]
}
type Network struct {
    parent optional Channel
    loopback optional Channel
    io optional Channel

    channels optional Channels

    # alias maps to channelIds
    children optional HashMapRoot           # keys are local paths
    uplinks optional HashMapRoot            # keys are channelIds, value=true
    downlinks optional HashMapRoot          # keys are remote paths
    symlinks optional HashMapRoot           # local paths : any paths
    hardlinks optional HashMapRoot          # local paths : any paths
}
```

## Provenance

Basically answers where did the current snapshot of the `Dmz` come from.

A `StateTreeNode` is used to provide an overlay tree to separate the covenant defined knowledge from the activity that the system operations generate while tending to the covenants intentions.

`lineageTree` is a tree now, not a chain, and this link points to the root of the tree.

`turnoversTree` lists all the `Pulse`s that changed the validator set or quorum threshold, to allow rapid validation without seeing every block in the chain.

The only Pulse that does not have a transmissions slice is the genesis Pulse.

WARNING state tree needs to use a HAMT for size

```sh
type StateTreeNode struct {
    state &State
    binary &Binary
    children { String : &StateTreeNode }
}
type Lineage [Link]          # TODO use a derivative of the HAMT as array ?
type Turnovers [PulseLink]   # TODO make into a tree
type Provenance struct {
    dmz &Dmz
    states &StateTreeNode
    lineages &Lineage     # Must allow merging of N parents

    validators &Validators
    turnovers &Turnovers
    address Address
    transmissions { String: Tx }
}
```

## Pulse

The Pulse actual is an array of signatures that satisfy the configuration of the `Dmz` that the signatures sign off on.

The CID of the first Pulse is used to derive the chainId.

```sh
type Pulse struct {
    provenance &Provenance
    signatures Signatures
}
```

## PulseLink

In some places, we want to avoid dereferencing CIDs during the uncrush process.
These places are always Pulses, and so the PulseLink class signals to the
uncrush process not to look any further.

If the program needs to dereference the actual Pulse, then it needs to do so explicitly, and should also free up the object when finished, to avoid holding any entire blockchain in ram.

```sh
type PulseLink link
```

## InterPulse

Structurally this is a Pulse, however for use within the model system, it is a Pulse that is not fully inflated. The Interpulse class is strictly a subset of the data contained in the Pulse class.
Note that the CID of an Interpulse is exactly the same as the Pulse that created it.

```sh
type InterProvenance struct {
    validators optional &Validators
    turnovers optional &Turnovers
    address Address
    transmissions { String: Tx }        # string addresses mapped to Tx's
}
type InterPulse struct {
    provenance &InterProvenance
    signatures Signatures
}
```
