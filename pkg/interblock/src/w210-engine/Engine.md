## Overview

The purpose of the Engine is to execute and coordinate all possible chain behaviours that are valid. Behaviours include: merging, forking, consensus conflicts, verification, multi chain interaction, versioning, covenant upgrades

The Engine has 3 types of event that it can process:

1. Interpulse updates - new interpulse for a chain we validate has occured
1. Pool updates - where there is a new pool for a chain
1. Pulse updates - a new Pulse as been formed

The Engine operates in local mode by default, meaning that it uses javascripts single threaded nature to guarantee locks. The engine can be connected to a hints service, which does the job of sharing the work of this engine with other engines, and can sometimes trigger the 3 engine events out of turn because they were caused externally. Interpulse updates trigger a pool update which triggers a pulse update. Pool updates trigger a Pulse update. Pulse updates trigger a pool update as the pool need to be reconciled with the new Pulse.

Pools are used to propose the next pulse, with a Pool update being used to send round something with your signature on it

## Pierce

Pierce is the means by which external Requests and Replies enter into chainland. Pierce is considered a form of pool update.

## Subscriptions

Clients will normally subscribe to Pulse updates. Validators will always subscribe to Interpulse updates, and in a multivalidator group, will also subscribe to Pool updates.

## TODO

Engines operate in one of four roles relative to a given chain:

1. proposing
2. validating
3. witnessing
4. consuming

## Effects

Execution secondarily deals with the running of side effects. This is because the loading of a covenant is the same for block making as it is for effects.
