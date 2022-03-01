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
The model includes some predefined link types: `ROOT`, `LOOPBACK`, `INVALID`, and `GENESIS`.

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
Later will be extended to implement generators.

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
At the start of each block, all transmitting channels are zeroed. Validators may coordinate transmission workloads by sharing the pooled softblock where they each zero out channels as they get sent, to ensure all interblocks are sent, and to parallelize the work.

```js
const TxExample = {
    genesis: CIDGenesis,
    precedent: CIDPrecedent,
    system: {
        requestsIndex: 23423,
        requests: [action1, action2, action3],
        repliesIndex: 3324,
        replies: [reply1, reply2, reply3, reply4]
        promisedIds: [ 32, 434, 435 ],
        promises: [
            { index: 12, reply: reply5 },
            { index: 9, reply: reply6 }
        ]
    },
    covenant: {
        requestsIndex: 84587,
        requests: [],
        repliesIndex: 868594,
        replies: [reply1]
        promisedIds: [ 3, 562, 9923 ],
        promises: []
    }
}
```

```sh
type Settle struct {
    requestId Int
    reply &Reply
}
type Mux struct {
    requestsIndex Int
    requests [&Request]
    repliesIndex Int
    replies [&Reply]
    promisedIds [Int]
    promisedReplies [Settle]
}
type Tx struct {
    genesis &Address   # The remote chainId
    precedent &Pulse   # The last Pulse this chain sent
    system Mux         # System messages
    covenant Mux       # Covenant messages
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

If a channel is unresolved, it is in the unresolved list, which is actively managed by the system. This is a list of ints that reference the channels list for this items that are unresolved.

There may be many aliases mapped to the same channelId.

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

Provides a CID and some info about a covenant, which is a package of code that is to be executed. The code package links to a raw binary.

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
type Covenant struct {
    name String
    version String
    type PackageTypes
    systemPackage optional String
    package optional Link
}

```

## Timestamp

Date example `2011-10-05T14:48:00.000Z`

```sh
type Timestamp struct {
    date String     # ISO8601 standard string
    epochMs Int     # ms since unix epoch
}
```

## ACL

Will contain a list of what groups have access to what paths, and what actions they can use at those paths. Then, a list of users to groups. Basically copying Linux, so probably chmod will be stored with the chains.

```sh
type ACL struct {

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
}
```

## Pending

Tracks what was the covenant action that caused the chain to go into pending mode, stored by channelId and actionId. It then keeps track of all outbound actions made while the chain is in pending mode whenever the covenant is run. The chain is only rerun once replies have been received that settle all the outbound requests.

This avoids rerunning the covenant many times pointlessly while it is waiting for many actions to resolve, and it keeps giving back the same result.

This structure consists of two arrays - one of all the outbound requests the covenant made, and another of all the so far received replies. The reducer should not be invoked until all the empty slots in the `replies` array have been filled.

```sh
type RequestId struct {
    channelId Int
    requestId Int
}
type PendingRequest struct {
    request &Request
    to String
    id RequestId
}
type Pending struct {
    pendingRequest optional RequestId
    requests [PendingRequest]
    replies [&Reply]
}
```

## Config

Entropy is a seed used to provide pseudorandomness to the chain. Initially it is used to ensure the genesis blocks are strongly unique, but every time a function requests some random data, we increment the count, then run a twister function that many times to generate the randomness. The count can be zeroed by storing the current value of the twister. If the covenant is pending, this count is not increased, but rather the count in Pending slice is increased temporarily.

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
    isPublicChannelOpen Bool # May specify based on some list of approots
    acl &ACL
    interpulse &Interpulse
    entropy Entropy
}
```

## PulseContents

The Pulse structure is required to be both the snapshot of a stable state and a working object used to pool with. When in pooling mode, it must be additive, in that if a block was begun with one version of the pool, using IPFS to determine what the diff of the next pool should allow a new blocking effort to begin without any backtracking.

An example of where such backtracking might occur if designed poorly is in the induction of Pierce actions. As these are put into a virtual channel, each time they are pooled, a new virtual Pulse needs to be created, to permit blocking to have already begun, then carry on immediately using the next pooled Trie.

A `StateTreeNode` is used to provide an overlay tree to separate the covenant defined knowledge from the activity that the system operations generate while tending to the covenants intentions.

`lineage` is a tree now, not a chain, and this link points to the root of the tree.

```sh
type Lineage [Link]
type Turnovers [&Pulse]  # TODO make into a tree
type StateTreeNode struct {
    state &State
    binary &Binary
    children { String : &StateTreeNode }
}
type PulseContents struct {
    approot &Pulse
    validators &Validators
    config &Config
    covenant &Covenant
    binary Binary
    timestamp Timestamp
    network &Network
    state &State
    meta &Meta
    pending &Pending
}
type Provenance struct {
    stateTree &StateTreeNode
    lineageTree &Lineage     # Must allow merging of N parents
    turnoversTree Turnovers
    genesis &Pulse           # Allows instant chainId lookup
    contents &PulseContents
}
```

## Pulse

The Pulse actual is an array of signatures that satisfy the configuration of the `PulseContents` that the signatures sign off on.

The CID of the first Pulse is the chainId.

```sh
type Pulse struct {
    provenance &Provenance
    signatures Signatures
}
```
