# Ipld Schemas for Interpulse

Read the [Guide to IPLD schemas](https://ipld.io/docs/schemas/using/authoring-guide/) to understand the syntax.

Any changes to this file need to be followed by running `yarn schemas` to generate the file `src/w014-schemas/ipldSchemas.js` which is imported by all the Models in `w015-models`

## Any

A convenience mapping to allow any javascript object

```sh
type Any union {
    | Bool   bool
    | Int    int
    | Float  float
    | String string
    | Bytes  bytes
    | Map    map
    | List   list
    | Link   link
} representation kinded
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
    key String
    nickname String
    algorithm PublicKeyTypes
}
```

## Validators

```sh
type Validators struct {
    quorumThreshold Int
    validators [&PublicKey]
}
```

## Signatures

An array of signatures as base encoded strings that matches the order of the Validators list.
Gaps in the array represent missing signatures, which might still pass quorum.

```sh
type Signatures [String]
```

## Tx

A transmission that is destined for some chainId, which might be as yet unresolved.  
At the start of each block, all transmitting channels are zeroed and the precedent is updated. Validators may coordinate transmission workloads by sharing the pooled softblock where they each zero out channels as they get sent, to ensure all interblocks are sent, and to parallelize the work.

```js
const TxExample = {
    genesis: CIDGenesis,
    precedent: CIDPrecedent,
    system: {
        requestsStart: 23423,
        requests: [action1, action2, action3],
        repliesStart: 3324,
        replies: [reply1, reply2, reply3, reply4]
        promisedIds: [ 32, 434, 435 ],
        promisedReplies: [
            { requestId: 12, reply: reply5 },
            { requestId: 9, reply: reply6 }
        ]
    },
    covenant: {
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
    requests [&Request]
    repliesStart Int
    replies [&Reply]
    promisedIds [Int]
    promisedReplies [PromisedReply]
}
type Tx struct {
    genesis Address   # The remote chainId
    precedent &Pulse   # The last Pulse this chain sent
    system TxQueue         # System messages
    covenant TxQueue       # Covenant messages
}
```

## Channel

`tip` matches up with precedent on the other side.

```sh
type RxTracker struct { # tracks what counters each ingestion is up to
    requestsTip Int
    repliesTip Int
}
type Channel struct {
    tip &Pulse          # The last Pulse this chain received
    system RxTracker
    covenant RxTracker
    tx Tx
}
```

## Network

Every channel is given an index, which is monotonic since the start of the chain.
This ID stays with the channel for its entire lifecycle.
Internally, everything references channels by this id, with the advantage being communications are unaffected by renames or resolving the chainId, and when actions are dispatched, a unique identifier can be given to the action sender regardless of the current point in the lifecycle of the chain.

There may be many aliases mapped to the same channelId.

Strings are used in the channels map, to effectively give sparse arrays in json.

```sh
type SystemRoles enum {
    | PARENT("..")
    | LOOPBACK(".")
    | CHILD("./")
    | UP_LINK
    | DOWN_LINK
    | PIERCE
}
type Alias struct {
    systemRole SystemRoles
    channelId Int
}
type Network struct {
    counter Int
    channels { String : Channel }   # Map of channelIds to channels
    aliases { String : Alias }      # Map of aliases to channelIds
}
```

## Covenant

The Covenant system uses a PulseChain to represent a code package and its various revisions. This PulseChain may have children to represent subpackages, and may include forks, representing different flavours of release such as beta, dev, and prod.

The PulseChain will include CID links to the git repos that the code was generated from, strengthening the link between running code and committed code.

To determine what packages to load, we need to be told what chainId to look for, and then which specific Pulse in that PulseChain contains the version we will be running. In development mode, we override this lookup by developer supplied functions at runtime, to allow rapid feedback.

Publishing new versions of your code is done by making a new Pulse in the PulseChain. Your software package may be connected to, or listed on an aggregator PulseChain, to allow centralized searching. Permissions and other management concerns are handled with the standard PulseChain methods.

To be a valid Pulse that we can load code from, we need some minimum information in the state, described in the schema below. System covenants are loaded from the chain that they publish from, the same as user supplied covenants, except we shortcut the lookup and load process, and we also skip containment.

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
    genesis Address
    pulse &Pulse
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

Tracks what was the covenant action that caused the chain to go into pending mode, stored by channelId and actionId. It then keeps track of all outbound actions made while the chain is in pending mode whenever the covenant is run. The chain is only rerun once replies have been received that settle all the outbound requests, to avoid wasteful rerunning.

This structure consists of two arrays - one of all the outbound requests the covenant made, and another of all the so far received replies. The reducer should not be invoked until all the empty slots in the `replies` array have been filled.

```sh
type RequestId struct {
    channelId Int
    requestId Int
}
type PendingRequest struct {
    request &Request
    to String       # Alias at time of invocation
    id RequestId
}
type Pending struct {
    pendingRequest optional RequestId
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
type Interpulse struct {
    version String
    package Binary
}
type Entropy struct {
    seed String
    count Int
}
type Config struct {
    isPierced Bool
    sideEffects SideEffectsConfig
    isPublicChannelOpen Bool # May be list of approots
    acl &ACL
    interpulse &Interpulse
    entropy Entropy
    covenant &Covenant
}
```

## Dmz

The Pulse structure is required to be both the snapshot of a stable state and a working object used to pool with and process with. When in pooling mode, it must be additive, in that if a block was begun with one version of the pool, using IPFS to determine what the diff of the next pool should allow a new blocking effort to begin without any backtracking.

An example of where such backtracking might occur if designed poorly is in the induction of Pierce actions. As these are put into a virtual channel, each time they are pooled, a new virtual Pulse needs to be created, to permit blocking to have already begun, then carry on immediately using the next pooled DAG.

```sh
type Lineage [Link]         # TODO define DAG tighter
type Turnovers [&Pulse]     # TODO make into a tree
type StateTreeNode struct {
    state &State
    binary &Binary
    children { String : &StateTreeNode }
}
type Dmz struct {
    approot &Pulse          # The latest known approot
    validators &Validators
    config &Config
    binary Binary
    timestamp Timestamp
    network &Network
    state &State
    meta &Meta
    pending &Pending
}
```

## Provenance

Basically answers where did the current snapshot of the `Dmz` come from.

A `StateTreeNode` is used to provide an overlay tree to separate the covenant defined knowledge from the activity that the system operations generate while tending to the covenants intentions.

`lineageTree` is a tree now, not a chain, and this link points to the root of the tree.

`turnoversTree` lists all the `Pulse`s that changed the validator set or quorum threshold, to allow rapid validation without seeing every block in the chain.

```sh
type Provenance struct {
    stateTree &StateTreeNode
    lineageTree &Lineage     # Must allow merging of N parents
    turnoversTree &Turnovers
    genesis Address
    contents &Dmz
}
```

## Pulse

The Pulse actual is an array of signatures that satisfy the configuration of the `Dmz` that the signatures sign off on.

The CID of the first Pulse is the chainId.

```sh
type Pulse struct {
    provenance &Provenance
    signatures Signatures
}
```
