# Ipld Schemas for Interpulse

Read the [Guide to IPLD schemas](https://ipld.io/docs/schemas/using/authoring-guide/) to understand the syntax.

Any changes to this file need to be followed by running `yarn schemas` to generate the file `src/w014-schemas/ipldSchemas.js` which is imported by all the Models in `w015-models`

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

## Action

Messages for communicating with a reducer.
Actions are always delivered as part of a channel between chains.
These are effectively [Redux](https://redux.js.org) actions, with an addition of an IPLD CID for adding binary data.

```sh
type Action struct {
    type String
    payload { String : Any }
    binary optional Link
}
```

## Continuation

Actions that implement the continuation system.
One of three types. Synchronous replies are resolves or rejections too.

```sh
type ContinuationTypes enum {
    | REJECT
    | PROMISE
    | RESOLVE
}
type Continuation struct {
    type ContinuationTypes
    payload { String : Any }
    binary optional Link
}
```

## Pulse

```sh
type Pulse struct {
    genesis &Pulse
    lineage Link
    turnovers Link
}
```

## Provenance

Proof of the Provenance of the object referenced by signed integrity.
The integrity of the first provenance in a chain is the chainId.
The integrity which is signed is the integrity of the whole object,
minus "integrity" and "signatures" keys

Integrity can be a merkle proof so a large group of chains with the same
validators can have all their next blocks signed with a single signature by
creating signatures for the root hash, then distribute
to all the chains. This can help with speed as running chains internally
is much faster than cross block boundaries.

```sh
type Provenance struct {
    contents Link
    signatures Signatures
}
```

## Address

Special object that wraps a link, just like RawBinary wraps a Block.
Without it, information attempts to be implied by what a link is.

```sh
type Address link
```

## Public Key

`key` is an IPFS PeerID

`PublicKeyTypes` comes from [`js-libp2p-crypto`](https://github.com/libp2p/js-libp2p-crypto/blob/125d33ca7db2b7ef666d1c1425e10827a7555058/src/keys/keys.js#L20)

```sh
type PublicKeyTypes enum {
    | Ed25519
    | Secp256k1
    | RSA
}
type PublicKey struct {
    key String
    name String
    algorithm PublicKeyTypes
}
```

## Validators

```sh
type Validators [PublicKey]
```

## Signatures

An array of strings that matches the order of the Validators list

```sh
type Signatures [String]
```

## Tx

A transmission that is destined for some chainId, which might be as yet unresolved.

CID links cannot be used as keys in maps, hence the use of nested arrays.
The CIDs must be provided in order.

The sneaky part is that the CID of an action is actually the precedent of the InterPulse that it arrived on. This is so that a permanent ID can be given to an action when it is created, which is a time when the currently Pulsehash is unknown.

```js
const TxExample = {
  genesis: CIDGenesis,
  precedent: CIDPrecedent,

  requestsIndex: 23423,
  requests: [action1, action2, action3],
  repliesIndex: 3324,
  replies: [reply1, reply2, reply3, reply4]
  promisesIndex: [ 32, 434, 435 ],
  promises: [ { index: 12, reply: reply5 }, { index: 9, reply: reply6 } ]
}
```

```sh
type IndexedPromise struct {
    index Int
    reply Continuation
}
type Mux struct {
    requestsIndex Int
    requests [Action]
    repliesIndex Int
    replies [Continuation]
    promisesIndex [Int]
    promises [IndexedPromise]
}
type Tx struct {
    genesis &Pulse              # The remote genesis aka chainId
    precedent &Pulse            # The last Pulse this chain sent from
    system optional Mux         # System messages
    covenant optional Mux       # Covenant messages
}
```

## Channel

`tip` matches up with precedent on the other side

```sh
type Channel struct{
    tx Tx
    systemRole SystemRoles
    tip &Pulse                  # The last Pulse this chain received
    system Mux
    covenant Mux
}
```

## Network

Every channel is given an index, which is monotonic since the start of the chain.
This ID stays with the channel for its entire lifecycle.
Internally, everything references channels by this id, with the advantage being communications are unaffected by renames or resolving the chainId, and when actions are dispatched, a unique identifier can be given to the action sender regardless of the current point in the lifecycle of the chain.

If a channel still has some activity that it is trying to do, it is in the Txs list.

If a channel is unresolved, it is in the unresolved list, which is actively managed by the system. This is a list of ints that reference the channels list for this items that are unresolved.

There may be many aliases mapped to the same channelId.

```sh
type Txs struct {
}
type SystemRoles enum {
    | PARENT
    | LOOPBACK
    | CHILD
    | UP_LINK
    | DOWN_LINK
    | PIERCE
}
type Alias struct {
    systemRole SystemRoles
    channelIndex Int
}
type Network struct {
    channels [ Channel ]        # Array of channels where the index is the channelId
    aliases { String : Alias }  # Map of aliases to channelIds
    txs Txs                     # Active channels
    unresolved [Int]            # ChannelIds that are unresolved
}
```
