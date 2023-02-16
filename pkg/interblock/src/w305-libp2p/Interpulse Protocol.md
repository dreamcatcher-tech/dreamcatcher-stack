# The Interpulse Announce Protocol

This protocol is required because interpulse activity is too specific to be served by pubsub and dht, as the number of combinations of publisher and subscriber are roughly N^2. To additionally preserve privacy seems too much to ask from existing distributed protocols, and so our own simple implementation is added with the hope we can make a Dreamcatcher Request for a more scalable alternative once we understand our use case a little better.

When used in conjunction with bitswap, nodes are able to receive new Pulses created by other nodes.

## Contracts

There are two other parts of the system that contracts are offered to. The first is the internal contract with the Interpulse Engine, and the other is with remote instances of the protocol manager on other nodes, which are not to be trusted.

> The contract with the engine is Interpulses in order, and consecutive. <br/>
> The contract with local subscribers is Pulses in order and consecutive. <br/>
> The contract with remote validators are Interpulses pushed in order, but non consecutive <br/>
> The contract with remote subscribers is Pulses in order, but non consecutive

Note that the engine never has reason to ask for remote Pulses. This is because to ensure determinism, references to remote chains must be done using reference to an approot, which in turn must be supplied at pulse creation time.

There are two types of communication - intra validator where a group seek consensus on a chain, and inter validator where one group of validators wants one of their chains to talk with a chain managed by another group of validators.

## Principles

1. Announcing an Interpulse is push, and is the responsibility of the transmitter, Pulse is pull, and is the responsibility of the consumer.
2. Interpulses cannot be subscribed to, they are merely announced - only Pulses can be subscribed to
3. A node can have only one crypto key
4. Nodes can end an Announce connection for any reason, such as over capacity or idleness
5. No gossiping or relaying of information
6. This protocol is at best a hint, as even honest nodes have delays and disconnections, so the reference data is always the signed pulses. Later a punishment may be enacted against corrupt nodes.
7. If a quorum of validators state the same view of latest, the recipient can trust this result
8. This protocol is for announcing a new latest pulse and a new latest Interpulse. Fetching an arbitrary subsequence of pulses is done using the lineage tree, hence there is no query support.  Catchup of Interpulses is done by walking `tip` pulseIds back from latest
9. No advertisement of available chain addresses is provided for privacy reasons
10. Announcements for Pulses are only done for approot pulses, as this is all that is required to know if some child has changed
11. The same subscription methods are used for pulses as well as for interpulses, with the only difference in the payload being the `target` key on an interpulse, so the recipient knows what path in the Pulse to request to avoid getting blacklisted for probing forbidden paths
12. Programmatically subscriptions are managed using [async iterables](https://www.npmjs.com/package/streaming-iterables) because this is the default way libp2p handles protocol transmissions
13. Protocol state is stored in ram because a reboot requires the connections to be re-established and re-authenticated. We may store peer:address mappings later, to help speed up rediscovery
14. No subscription request is refused, it may have been silently discarded if the requester failed to meet permissions
15. Requests need to provide path information so the receivers know how to find the destination chain.  Replies do not provide path info as the sender is responsible for having their chains ready to receive.  Basically Requesters have the energy burden, and replies are the laziest possible.
16. All chains have a root somewhere, and all chains have a parent.  There can be no chains refered to by purely addresses since we would never know how to find them within an engine.  The path gives the notion of latest, since it is latest relative to the current root latest.
17. Every pulse stored in an engine can be reached by walking a path from root

## Pathing on the target engine

There is no map of chainIds on the engine, so the target chain must be discovered by path.  The sender must know the path relative to the share they are receiving.  In the advent that the path changes between when they transmit and when they send a result, they can resent the announce with the new path.  They should not be punished for sending with an invalid path, provided the attempt was in earnest, so they should send the pulselink for the share they are basing the path off.

Interpulses that are replies only and not requests need not provide pathing information. If the sender rebooted, then tension records would cause it to recover what the outbound requests were already, permitting a direct lookup of the address.

## Complex to Complex communication

If the ACL permits it, then nested chains in one complex could talk to nested chains in another complex by referencing the root of the complex.  The root acts like a socket in this case, and provides a means for receiver to work out permissions, and on response, for the sender to locate the sender if they have crashed and lost their cache of latest.

## Implementation

### New Pulse created

Each new pulse that triggers the announce() function in endurance, triggers this process:

1. check if permissions for the pulse changed, and remove any subscriptions if so
2. check all the subscriptions in the ram map for the pulse address
3. trigger all that are allowed to see the pulse fully
4. of what is left, look for those that are allowed to see the interpulse
5. if any transmission recipients are not subscribed, queue them up to be discovered
6. send each one an announcement of the pulselink, and optionally the path within to be used for interpulses

The internal design is such that the wishes of the system are recorded, and then a worker attempts to discover what nodes are required in order to pass on the announcements. The recipient of an announcment triggers an async iterator yield with shape:

```js
{ fromAddress, latest[, targetAddress] }
```

where targetAddress is provided when an interpulse is being sent, and tells the recipient what path to ask for in the interpulse to avoid any security triggers. `fromAddress` is used to allow multiplexing on the connection. It is an error to send a response that was not asked for, and this may result in disconnection.

### Interpulse Received

Each announce must be valid or the connection will be closed.  Repeated bad behavior will blacklist a peer.

1. try lookup the address directly
1. if fail, lookup the root pulselink
1. walk the path to target
1. if no latests, use this as the latest
1. check if interpulse precedent matches
1. use bitswap to walk the interpulses back until find the required precedent
1. insert all the walked interpulses into the pool

### Interpulse sent back

When a server has received an interpulse into one of the chains it is serving, then it will need to send an interpulse back.  When it responds, the requester may have rebooted, so it needs a way to relocate the sending chain.  The server has no path info from the origin request, and so it can cannot provide a path back.

For this reason, any outbound chains need to be kept somewhere the engine knows how to find quickly.  So on reply, if pathToTarget is not given, it defaults to `/` and root defaults to the last received pulseLink on the inbound.  On reboot, tensions should be loaded first before announces are processed.  Announces received before recovery is complete should be buffered, as the network should start listening as soon as possible.

## Message Types

Subscribe and unsubscribe are for full Pulses only, whereas interpulse is validator to validator, and uses Announce as it is a push event.  Later relayers that are not validators may be permitted to push interpulse announces to the validators of the recipients.

### `SUBSCRIBE { fromAddress, isSingle, proof }`

### `UNSUBSCRIBE { fromAddress }`

### `UPDATE { address, latest }`
Announces new Pulses to subscribers.  

### `ANNOUNCE { source, target, root, path }`
`source` is a PulseLink.
`target` is an Address.
`root` is a PulseLink.
`path` is an absolute path.

`source` is required to be downloaded in good faith by the receiver.  If it is slow or malicious it will be abandoned.  If the combination of all provided vars proves not to be valid, the peer will be blacklisted, so the pre-emptive acquisition of the pulselink contents is not an attack vector.

`root` is a pulselink that we will try and look up amongst our served items, if not present this request will be considered malicious.

Interpulses are pushed out actively - they do not use subscriptions.

Path is the absolute path to the targetAddress, starting with the given root pulselink.  Path and root are supplied so that recipients can know if a legit path was supplied, even if the path has shifted since transmission began.

If the path shifts during transmit, the sender needs to acknowledge that.

Sender needs to track its own chainIds that it sends from since the receiver will not know this info when it sents back.

Don't need targetAddress if provide path and root pulselink.

Announce will have a response, which is the latest transmission from the receiver, if there is one.  If there isn't one, then this will be sent once it is available.  There are no tracking IDs as the contract is loose.  If receiver crashes, requester will need to retry.

## Process for announce

## Extensions

### Use Tension in approot to reduce cross complex announces
Instead of targeting each recipient directly, we could roll up into the approot and just trade those top level announcements

### Receive announces from multiple conflicting sources

Be able to make a decision as to what to pass to the engine when receiving noisy and intermittent signals. We should be invulnerable to malicious announces, and we should be able to determine the correct latest when many signals were received, and when some were missed.

### Resolve the pulselinks and order them correctly

Before passing on a signal, seek to resolve the pulselink and verify its place in the event stream. Ensure it is not a repeat, and if the full history option was on, seek out any missing items. A worker process will first validate the hints it received for latest, and then will use the lineage tree to fill in any gaps before passing along the signal to the engine or the local subscribing function.

### Replace later announces if buffer not flushed

If connection is choked and some announces to a given peer have not made it off engine yet, replace them, as it is far more useful to let them know the latest, rather than everything that occurred before latest. Announcements are monotonic but not consecutive - a buffered announce yet to be transmitted will be replaced by a later one

### Seek out peers

When given a pulse, look at the validators and ACL lists and begin to seek out peers to subscribe to if we do not already have a connection to them. Seek out chains that are connected to the chains we are interested in and seek connections to those validators too.

### Indefinite retry on Interpulse

If an interpulse is due for transmission, keep trying until we have delivered the announcement to all the validators that can process it. Keep track of the status of this task and permit progress related events. Also have larger summary events, such as reaching a quorum of validators, then reaching the full validator set, as well as reaching individual validators.

Stop if a pulse is received that has ingested a reply from the remote target.

### Persist long running tasks

Store outstanding announcements for interpulses in persistence, and restart the push effort when the node restarts

### Gossiping and Relaying

Nodes helping other nodes finding each other, and relaying announcements on behalf of others. Has permissions problems that need to be contained somehow.

### Multiple validators receiving Pool

Pool is a Pulse that contains more information that its previous Pulse, but has not got all the signatures required to be a Pulse. Validators would use this protocol to announce to each other when they had a new Pool for consideration.

### Tunneling thru socket chains

Interpulses across validator sets should be limited by all being tunneled through a single chain. This reduces the amount of independent chatter on the protocol, and allows a single choke point to disconnection any foreign actor.
