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

## Pathing on the target engine
There is no map of chainIds on the engine, so the target chain must be discovered by path.  The sender must know the path relative to the share they are receiving.  In the advent that the path changes between when they transmit and when they send a result, they can resent the announce with the new path.  They should not be punished for sending with an invalid path, provided the attempt was in earnest, so they should send the pulselink for the share they are basing the path off.
## Implementation

Each new pulse that triggers the announce() function in endurance, triggers this process:

1. check if permissions for the pulse changed, and remove any subscriptions if so
2. check all the subscriptions in the ram map for the pulse address
3. trigger all that are allowed to see the pulse fully
4. of what is left, look for those that are allowed to see the interpulse
5. if any transmission recipients are not subscribed, queue them up to be discovered
6. send each one an announcement of the pulselink, and optionally the path within to be used for interpulses

The internal design is such that the wishes of the system are recorded, and then a worker attempts to discover what nodes are required in order to pass on the announcements. The recipient of an announcment triggers an async iterator yield with shape:

```js
{ fromAddress, latestPulseLink[, targetAddress] }
```

where targetAddress is provided when an interpulse is being sent, and tells the recipient what path to ask for in the interpulse to avoid any security triggers. `fromAddress` is used to allow multiplexing on the connection. It is an error to send a response that was not asked for, and this may result in disconnection.

## Message Types

### `SUBSCRIBE { fromAddress, isSingle, proof }`

### `UNSUBSCRIBE { fromAddress }`

### `ANNOUNCE { fromAddress, latestPulseLink, targetAddress, path, root }`

Subscribe and unsubscribe are for full Pulses only, whereas interpulse is validator to validator, and uses Announce as it is a push event.  Later relayers that are not validators may be permitted to push interpulse announces to the validators of the recipients.

Path is the absolute path to the targetAddress, starting with the given root pulselink.  Path and root are supplied so that recipients can know if a legit path was supplied, even if the path has shifted since transmission began.

## Extensions

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
