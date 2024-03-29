# Ipld Schemas for Interpulse

Read the
[Guide to IPLD schemas](https://ipld.io/docs/schemas/using/authoring-guide/) to
understand the syntax.

Any changes to this file need to be followed by running `yarn schemas` to
generate the file `src/w014-schemas/ipldSchemas.js` which is imported by all the
Models in `w015-models`

## HAMT

Schemas for the hash array mapped trie used to allow the Network to have an
arbitrarily large number of channels and still remain performant.

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

Special in that it exposes a raw link, but adheres to the model interface for
interop with the other models here. Similar to Address in that it exposes an
IPLD primitive.

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

Addresses are always CID version 0, which makes them easy to distinguish at a
glance from `Pulse`s and `Binary`s, which are CID version 1.

An address is the version 0 CID that links to the version 1 CID of the first
Pulse of a given chain.

```sh
type Address link
```

## Request

Messages for communicating with a reducer. Requests are always delivered as part
of a channel between chains. These are effectively [Redux](https://redux.js.org)
actions, with an addition of an IPLD CID for adding binary data.

```sh
type Request struct {
    type String
    payload { String : Any }
    binary optional Binary
}
```

## Reply

Messages that implement the continuation system. One of three types. Immediate
replies are resolves or rejections too. Later these types will be extended to
implement generators.

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

`PublicKeyTypes` comes from
[`js-libp2p-crypto`](https://github.com/libp2p/js-libp2p-crypto/blob/125d33ca7db2b7ef666d1c1425e10827a7555058/src/keys/keys.js#L20)

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

An array of signatures as `base36upper` encoded strings that matches the order
of the Validators list. Gaps in the array represent missing signatures, which
might still pass quorum. May be CID'd if space becomes an issue.

```sh
type Signatures [String]
```

## Covenant

This is the most important part of the system offering enhancement over IPFS.
This model is how we go from content addressable storage to content addressable
execution. Covenants are how programmable behaviour is introduced to IPFS,
approaching IPEX - the InterPlanetaryExecutable™.

The Covenant system uses a PulseChain to represent an executable code package,
using the chain data structure to capture revisions of the software. This
PulseChain may have children to represent subpackages, and may include forks,
representing different flavours of release such as beta, dev, and prod. A
Covenant represents the executable piece of language specific code and its
provenance. By way of parents running `repo` Covenants, the PulseChain may
include hash links to the git repos that the code was generated from,
strengthening the link between running code and source code.

To determine what packages to load, we need to be told what chainId to look for,
and then which specific Pulse in that PulseChain contains the version we will be
running. This determination requires a Covenant Resolution Strategy. In
development mode, we override this strategy with developer supplied functions at
runtime, to allow rapid feedback.

To be a valid Pulse that we can load code from, we need some minimum information
in the state, described in the example below. System covenants are loaded the
same as user supplied covenants - from the chain that they publish to - except
we shortcut the lookup and load process, and we also skip containment for them
by default. Developers can skip containment for their covenants, but this needs
to be configured in Engines they control.

By way of example, the format of the state within the Covenant is:

```js
{
    name: `some-internal-sluggified-name`, // a hint for consumers
    version: `0.3.2` // semver version string
    loader: `javascript` // which interblock loader to use on the binary image
    api: { // the actions api of this covenant
        TEST: {
            type: 'object',
            properties: {
                anything: { type: 'string', description: 'literally anything'}
            }
        }
    },
    installer: {
        config: {},
        state: {}, // optional initial state of the covenant, may be overridden
        network: { // any required children are specified here
            customers: {
                covenant: 'collection',
                state: { datum: { }},
                network: {
                    customer123: {} // can load some initial customers
                }
            },
            someRemoteChain: 'Address(QmYMKzxgro9NTb)'
        }
    },
    importMap: { // specify paths and the imports to override
        datum: 'interblock://privateRegistry1/datum',
        collection: 'sneakyNameChange',
    },
    registries: [ // ordered registries to look up any unresolved covenant names
        'interblock://registry1',
        'interblock://reg2',
        '/some/local/path',
        // referring to a specific pulse in a registry is the same as
        // using a package-lock.json
        'PulseLink(bafyreig3w5cuffzshczi5xzwnp4igna5wehxcisr53jcjtrfxcnbgzwrui)'
    ]
}
```

The lifecycle of the usage of a Covenant is:

1. Develop: code is loaded live while the developer makes changes, to remove
   publishing from the feedback loop
1. Publish: here the code is transformed into a filesystem image that can be
   loaded up and executed. Code dependencies are fetched here, and build steps
   are run, with build provenance provided
1. Resolve: A string in config is resolved into a pulselink that contains a
   Covenant
1. Install: A covenant is set as the running covenant of a new chain, and any
   children that are part of the installation are created. Note this may trigger
   nested covenants to begin their own installation process.
1. Load: A Covenants binary image is reified and within the isolation boundaries
   turned into executable code
1. Execute: Loaded code from the Covenants binary image is executed within the
   isolation boundary
1. Effects: Optionally side effects supplied from the binary image are executed

### Dependency Management

Modern code carries many dependencies. Here dependencies are split into 3 types:

1. Code level: these are specified using the package manager that your code type
   uses. Eg: npm, pip, cargo dependencies and are bundled together during the
   publish step. Only the loader and the publisher need to be aware of these.
2. Covenant level: these are pieces of code that represent a hash based
   reference to executable code. In nodejs, an executable is an npm package that
   has all its modules installed and optionally some transpilation applied.
3. Chain level: - this is a reference to a running chain, and is referenced by
   chainId. These can be oracles, services, people, or any other object in the
   chain based multiverse. These are interacted with using their json based API.

Each `covenant` instance is, by way of the chains that house them, capable of an
unlimited number of children. This in effect makes them a registry unto
themselves. The code that runs a large registry is intended to be exactly the
same as what runs a simple hello world covenant, differing only in child chain
count and internet popularity.

Given that covenants are a pulsechain, and interpulse itself is published as a
pulsechain, our design goal is that running interpulse on interpulse is possible
by specifying interpulse as the covenant of a chain, and configuring the engine
to run optimally within chain land. Furthermore the loader can be supplied as a
covenant, allowing custom loaders and publishers to be created.

The Covenant System is made of at least two distinct Covenants. The `covenant`
Covenant, which is the final step before the binary it contains is executed, and
the `repo` covenant, which acts as a parent for the Covenant, holding reference
to its source code, lineage, and other published artefacts. Ideally a `repo` is
a general purpose object used to model all kinds of code projects, whereas a
Covenant is the minimum interface we need to be able to use ipfs data as
executable code in a safe and chargeable way.

### The `repo` Covenant

A chain running the `repo` covenant represents a top level code repository that
is used to produce executable assets of various kinds. In order to not constrain
its use to solely interblock, the repo represents any kind of code that is
version controlled by git. It will hopefully be able to run build steps
triggered by commit, similar to github actions.

Under the `releases` child of the repo, there is another child for each type of
asset being released. For npm packages, this child is named `npm`, for python
packages `pip` and for Rust crates `crate` and so on. Likely, a build step would
have been required to produce each child.

The Repo can have any number of children that are also Repo covenants, which
allows monorepos to be managed in this fashion, or other types of relationship
to be expressed.

One of the interblock specific children under the `releases` child is the
`covenant` child, which contains a chain running the covenant of type `covenant`

### The `covenant` Covenant

Covenants are the way in which interblock specifies what transitional behaviours
are needed to model some useful object. Inevitably we need to model covenants
themselves, and the `covenant` Covenant is how we do that.

This covenant is duck typed, even tho we provide a reference implementation. The
reference Covenant does not allow having any children, as child relationships
must be managed by the `repo` Covenant, which should be the parent of a
Covenant.

The Binary of the Covenant is code that is ready to be instantly executed by the
isolator, to generate the next block. This is the place where binary data
becomes executable code. The Binary is equivalent to filesystem data, that a
programming language can load and execute without any remote fetching.

Once the binary image contained by the Covenant instance is loaded, we expect at
least one function to be provided, and can utilize up to four functions:

1. `reducer( state, action ) -> nextState + transmissions` (this function is
   required)
1. `effect( state, action ) -> transmissions`
1. `upgrade( state ) -> nextState + transmissions`
1. `downgrade( state ) -> nextState + transmissions`

Transmissions are actions that need routing to remote chains. The optional
`upgrade` function transitions from the previous state version to the current
one. It is recommended to supply this function separately from the reducer
because it gets different timeout settings, and it can be chained by the engine
if multiple upgrades need to occur at once, rather than the reducer having to
handle arbitrary upgrade paths. `downgrade` does the reverse, and again is
optional. Both these functions will be checked for correctness during publish
verification where semver is automatically calculated too.

Note that literally anything can be the executable - an RPC call, a docker
image - anything.

### Covenant Resolution System

In each chain, there is a string key named covenant, which states a name to be
looked up in the covenant resolution system, and then its binary is loaded to
execute the actions of this chain against its current state. This string needs
to be resolved to a specific pulse in a specific chain. It is vitally important
the covenant system become part of the state system at the earliest possible
architectural moment. Otherwise two separate name resolution systems exist with
the same purpose - turning bytes into cpu instructions.

For JS we endeavour to follow Deno where possible, as their module resolution
strategy results from lessons and regrets they had about the nodejs module
system, and also aligns directly with the browser module system. Deeper, we aim
to follow the guidance given by the
[import maps draft](https://github.com/WICG/import-maps#the-import-map).

The purpose of this system is to enable all the covenants of an app complex to
upgrade in a single point in time, as each chain in the complex has its covenant
resolution status checked before each pulse is made.

Given a pulse with a string as its covenant, the resolution process is:

1. get the approot out of the pulse
1. get the latest approot
1. assert the approot pulse has a resolvable covenant
1. get the covenant string out of the pulse
1. if the string is an absolute or relative path:
   1. assert it points to a valid covenant
   1. return
1. the string is bare, so begin the resolution walk
1. walk from the approot down to the child, checking each importMap of each
   covenant of each chain on the way down
1. If nothing found, check the registries specified in the approot
1. If still nothing, throw

### Covenant Registries

Registries exist to convert names of covenants into Pulses. Any Interblock chain
can be used as a registry and can respond to scale invariant requests for any of
its children. These are not actions, but are read requests, where the aliases of
children are used to represent covenants that match a name query. All that is
required to use this is the read permission.

Any resolution system has to go initially from a plain text string and resolve
that to something hashlockable. This is a weakness of all resolution systems,
from urls, to npm, to pip, to docker, and is a type of supply chain provenance
problem. We aim to minimize this problem by automatically hashlocking code as
early as possible, and making this so trivial for developers that they need to
actively opt out of the system. Further we aim to mitigate this problem by
economic incentives provided by pools. Pools will be set up that charge a fee to
have assurance that name to hash resolution is correct, and the pools pay out a
penalty if they are proven to be in error.

The engine is seeded with a default registry, but eventually we hope to move to
a /etc/hosts type of model, allowing the engine to have nothing hardcoded, and
to allow nodes to share their view of the hosts file, allowing context aware
lookups, which are based on who you know, not some brittle absolute view.

### Publishing

Publishing to an Interblock registry would be as simple as making a chain, and
pushing your git commits to it. You could optionally connect this chain to a
public chain that we supply to ensure replication and advertisement of your
changes. Hopefully we can later implement a language server that will allow
browsing covenant registries from the comfort of vscode
[Deno handles registries](https://deno.land/manual/language_server/imports)

Publishing the binary image for a Covenant leverages that all modern languages
can store their code on a posix based filesystem. IPFS has good native utilities
for hashing a posix folder. Most package managers appear to allocate one folder
per dependency installed, and so deduplication will naturally occur using IPFS
in this simple way. Deno for instance allows the `--vendor` command to do this.
Npm does this naturally.

### Conclusion

All this is to say that, the schema for representing Covenants on chain is:

```sh
type Covenant string
```

## Timestamp

Date example `2011-10-05T14:48:00.000Z`. In CI mode, the constant timestamp is:
`2022-02-22T02:22:22.222Z`, which allows for predictable chainIds to be
generated to take advantage of jests snapshot testing tooling.

```sh
type Timestamp struct {
    isoDate String     # ISO8601 standard string
}
```

## ACL

Will contain a list of what groups have access to what paths, and what actions
they can use at those paths. Then, a list of users to groups. Basically copying
Linux, so chmod permissions will be stored with the chains rather than in a
central list.

```sh
type ACL struct {
    # ACL will be done in a future revision
}
```

## State

The result of running a covenant is stored here, and must be serializable.

State is special in that it wraps an object directly, with no predefined keys.

```sh
type State { String : Any }
```

CID links inside the State are not allowed - the correct way for apps to break
down large state is to make a child chain. This allows for state of unlimited
size, so long as break points are well thought out. In the browser, this state
management allows for background managed memory eviction too, so as not to
overwhelm restricted devices.

## AI

Each node can be configured to be amplified by different kinds of AI. This
config can be set in the covenant, but it can also be set independently. This
can allow for a standard covenant like a datum to be used but let it have wildly
different behaviors depending on where it is in the Complex.

```sh
type GPT4 struct {
    instructions String
    topP Int
}
type Falcon40b struct {

}
type Claude struct {

}
type Llama struct {

}
type AI union {
  | GPT4 "GPT4"
  | Falcon40b "Falcon40b"
  | Claude "Claude"
  | Llama "Llama"
} representation envelope {
  discriminantKey "name"
  contentKey "assistant"
}
```

## Pending

Tracks each of the covenant Requests that caused the reducer to return a promise
in an AsyncTrail, which holds the channelId and requestId of the origin Request
it is tracking. The reducer is then rerun once replies have been received that
settle all the outbound requests, to avoid wasteful rerunning. Caching may reuse
a current isolation context and resolve the promises in it, so it doesn't have
to rerun the reducer again.

Each new set of Requests from each rerun are also tracked. Each rerun must
produce the exact same requests and replies each time, in the exact same order.
This includes any side effects - the functions should be checked against a
signature to ensure the same thing came out.

The AsyncTrail consists of two arrays - one of all the outbound requests the
covenant made: `txs`, and another of all the so far received replies: `settles`.
The reducer is not re-invoked until all the empty slots in the `settles` array
have been filled.

```sh
type RequestId struct {
    channelId Int
    stream String
    requestIndex Int
}
type AsyncRequest struct {
    request &Request
    to String
    requestId optional RequestId
    settled optional &Reply
}
type RxRequest struct {
    request &Request
    requestId RequestId
}
type AsyncTrail struct {
    origin RxRequest
    settles [AsyncRequest]
    txs [AsyncRequest]
    reply optional &reply
    openPaths optional [RequestId]
}
type Pending struct {
    system [&AsyncTrail]
    reducer [&AsyncTrail]
}
```

## Config

Entropy is a seed used to provide pseudorandomness to the chain. Initially it is
used to ensure the genesis blocks are strongly unique, but every time a function
requests some random data, we increment the count, then run a twister function
that many times to generate the randomness. The count is zeroed each Pulse by
storing the current value of the twister. If the covenant is pending, this count
is not increased, but rather the count in Pending slice is increased
temporarily.

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
}
```

TODO perhaps the version of interpulse should be based on the Covenant, and not
be independent.

## Dmz

The Pulse structure is required to be both the snapshot of a stable state and a
working object used to pool with and process with. When in pooling mode, it must
be additive, in that if a block was begun with one version of the pool, using
IPFS to determine what the diff of the next pool should allow a new blocking
effort to begin without any backtracking.

An example of where such backtracking might occur if designed poorly is in the
induction of Pierce actions. As these are put into a virtual channel, each time
they are pooled, a new virtual Pulse needs to be created, to permit blocking to
have already begun, then carry on immediately using the next pooled DAG.

### AppRoot requirements

AppRoot is a system chain, and contains within it some required config items
that can be deferred in child chains. It must also have some extra state.

It holds the registry of what covenant names resolve to what pulselinks. To
upgrade a package, this allows every chain in the complex to upgrade
simultaneously.

Individual chains may override `interpulse` and `covenant` but if they do not,
the approot version is the required version.

AppRoot cannot be inferred, since its state would be indeterminate depending on
what the Validator was perceiving. Order of operations for a given perception is
deterministic, but perceptions may be different but non conflicting.

Schema is a slice in the DMZ but is not a dedicated class.

```sh
type Dmz struct {
    config &Config
    timestamp Timestamp                 # changes every block
    network Network                     # block implies network changed
    state &State
    embeddings &Embeddings
    pending optional &Pending
    appRoot optional HistoricalPulseLink          # The latest known approot
    binary optional Binary
    covenant Covenant
}
```

## Embeddings

Embeddings represent the current AI embedding of the state and / or the binary
in a way that can be used by vector databases to find similarity. There can be
multiple embeddings for a particular Pulse. A flag is present to indicate if the
embedding is current or not, as the generation of an embedding can be
asynchronous to the change of the State or the Binary.

The types of embedding are specified in the approot.

Embeddings are used by peers to pull up relevant chains from anywhere in the
application. These queries are intended to be run in ram, where the chains are
loaded up in ram, and so fetching the embeddings is very quick. In some use
cases they serve as hints, in others they

The only requirement is that they be acceptably deterministic - so an AI query
can be run without a complete set of embeddings being returned, and in some
cases this is acceptable. In others, a full embeddings search may be required.
Either way, the proposer declares the results of the query so the witnesses can
reproduce the query.

The approot has a function that can be called to fetch embeddings that is
optionally narrowed down to any given path. This means that an AI can request
some embeddings from anything below a given path, and get back some relevant
info before making a response. It could ask for functions, in which case we
would look up covenants and then find chains that used that covenant.

## Tx

A transmission that is destined for some chainId, which might be as yet
unresolved.  
At the start of each block, all transmitting channels are zeroed and the
precedent is updated. Validators may coordinate transmission workloads by
sharing the pooled softblock where they each zero out channels as they get sent,
to ensure all interblocks are sent, and to parallelize the work.

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
    requestIndex Int
    reply &Reply
}
type TxQueue struct {
    requestsLength Int
    requests optional [&Request]
    repliesLength Int
    replies optional [&Reply]
    promisedRequestIds [Int]
    promisedReplies optional [PromisedReply]
}
type Tx struct {
    precedent optional PulseLink    # The last Pulse this chain sent
    system TxQueue                  # System messages
    reducer TxQueue                 # Reducer messages
}
```

## Rx

Tip represents the hash of the last interpulse that was accepted into this
channel. When ingesting an interpulse, the RxQueue is extended to include the
TxQueue that came with the interpulse. The data structure of RxQueue and TxQueue
is identical, but the functions presented to the system are different.

```sh
type RxQueue = TxQueue
type Rx struct {
    tip optional PulseLink          # The lastest known InterPulse
    latest optional PulseLink       # The latest known full Pulse
    system optional RxQueue
    reducer optional RxQueue
    isSubscription optional Bool    # notify the reducer when latest updates
}
```

## Channel

These queues and their responses are what all interchain communication seeks to
facilitate. All the cryptography employed in this system is to reliably process
these queues.

Each connection side has a transmit and a receive. Each connection side
transmits requests and replies to the other. Confusingly, a transmit of a reply
goes on the Tx channel, since Tx is used to form Interpulses, and Rx is used to
receive interpulses. All outbound comms, no matter if Request or Reply, must go
via the Tx channel.

Transmit = Sum( Channel ) Receive = Sum( Interblock( Channel ) ) Interblocks =
Channel + Provenance

`tip` matches up with precedent on the other side.

Tx and Rx are split out so that they can be stored on the block separately. Tx
needs to be separate so that remote fetching does not expose the channelId. Rx
needs to be separate to allow the ingestion of messages to be halted at any
point. Both are separate from Channel so that the potentially large HAMT that
stores all the Channel instances is updated as little as possible, whilst
providing rapid lookup to get channels that are active.

Tx needs to be hashed as it is an independent transmission, but Rx does not need
to be hashed.

The structure implements the design goal of making the Pulse be the context of
the state machine that processes all the actions.

Channel stores rx and tx only after all the activity has been wrung out of them.

Channel has functions to transmit actions, because it needs to update both tx
and rx to shift the next reply to be processed. In contrast, receiving actions
is done by calling the rx slice directly, as no modifications occur.

If the channel has an address, that implies the channel is open for Requests. We
may very well know that a path resolves to a certain address, but until we have
a direct connection to the chain, the address is left off.

```sh
type Channel struct {
    channelId Int
    address Address                 # The remote chainId
    tx &Tx
    rx Rx
    aliases [String]                # reverse lookup
}
```

## Loopback

Subclass of Channel that reverses Tx around on itself. Loopback is never counted
as transmitting, but if it has activity on its Tx slice, it is counted as
receiving

```sh
type Loopback = Channel
```

## Network

Every channel is given an index, which is monotonic since the start of the
chain. This ID stays with the channel for its entire lifecycle. Internally,
everything references channels by this id, with the advantage being
communications are unaffected by renames or resolving the chainId, and when
actions are dispatched, a unique identifier can be given to the action sender
regardless of the current point in the lifecycle of the channel.

There may be many aliases mapped to the same channelId.

A HAMT is used to track large amounts of data whilst storing only diffs.

Channel is not stored as a link, but as a full object, since inside of the
channel the Tx key will be stored as a link anyway, so no point double linking.

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

This does introduce non-determinism, as the timing of when something occurred
can now affect what address it was resolved to.

Network handles turning strings into channelIds

In essence, the Network is 3 maps:

1. Path strings to channelId integers (for devs)
1. Address strings to channelId integers (for interpulse crypto)
1. ChannelId integers to channel objects (for interpulse comms)

```sh
type Channels struct {
    counter Int
    list HashMapRoot               # Map of channelIds to Channels
    addresses HashMapRoot          # reverse lookup of channels
    rxs [ Int ]
    txs [ Int ]
}
type Network struct {
    channels Channels

    # alias maps to channelIds
    children optional HashMapRoot           # keys are local paths
    downlinks HashMapRoot                   # keys are remote paths
    uplinks optional HashMapRoot            # keys are channelIds, value=true
    symlinks optional HashMapRoot           # local paths : any paths
    hardlinks optional HashMapRoot          # local paths : any paths

    piercings optional Rx
}
```

## Provenance

Provenance answers where did the current snapshot of the `Dmz` come from.

A `StateTreeNode` is used to provide an overlay tree to separate the covenant
defined knowledge from the activity that the system operations generate while
tending to the covenants intentions.

`lineageTree` is a tree now, not a chain, and this link points to the root of
the tree.

`turnoversTree` lists all the `Pulse`s that changed the validator set or quorum
threshold, to allow rapid validation without seeing every block in the chain.

The only Pulse that does not have a transmissions slice is the genesis Pulse.

WARNING state tree needs to use a HAMT for size

```sh
type StateTreeNode struct {
    state &State
    children HashMapRoot     # { String : &StateTreeNode }
}
type BinaryTreeNode struct {
    binary &Binary
    children HashMapRoot     # { String : &BinaryTreeNode }
}
type Lineage [Link]          # TODO use a derivative of the HAMT as array ?
type Turnovers [HistoricalPulseLink]   # TODO make into a tree
type Provenance struct {
    dmz &Dmz
    stateTree &StateTreeNode
    binaryTree &BinaryTreeNode
    lineageTree &Lineage     # Must allow merging of N parents

    validators &Validators
    turnovers &Turnovers
    address Address
    transmissions { String: Tx }
}
```

## Pulse

The Pulse actual is an array of signatures that satisfy the configuration of the
`Dmz` that the signatures sign off on.

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

If the program needs to dereference the actual Pulse, then it needs to do so
explicitly, and should also free up the object when finished, to avoid holding
any entire blockchains history in ram.

Generically, there are three types of hashlinked data in any CAS system:

1. Internal to the object
2. External to the object
3. Historical to the object (could be internal or external)

```sh
type PulseLink link
```

## HistoricalPulseLink

All Content Addressed systems have a notion of current and history, since they
are all implicitly CoW. Having content that points to other content addresses is
common. When the content is mutated, the new content should reference the old,
for audit reasons. When asking to view the content in full, with all links
resolved, we often do not want the historical view unless we specifically ask
for it.

In order to automatically inflate the notion of 'current' without inflating all
of the linked history, a distinction is provided for developers to indicate
history.

```sh
type HistoricalPulseLink = PulseLink
```

## InterPulse

Structurally this is a Pulse, however for use within the model system, it is a
Pulse that is not fully inflated. The Interpulse class is strictly a subset of
the data contained in the Pulse class. Note that the CID of an Interpulse is
exactly the same as the Pulse that created it.

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
