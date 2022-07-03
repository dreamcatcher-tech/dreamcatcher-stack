Executions are the condensation of the effect pool
and interblock pool into new blocks, and/or new
broadcasts of existing blocks.

Execution primarily deals with the DMZ against a reducer,
the execution of which is the same in all three modes: 1. proposing 2. validating 3. witnessing

Execution secondarily deals with the running of side
effects. This is because the loading of a covenant is
the same for block making as it is for effects.

The execution environment is the only place that malicious
3rd party code can damage the system.

Execution forms the metrology toolkit, which tests the
interaction of the execution with the models, across all
possible chain behaviours that are valid. Behaviours include:
merging, forking, consensus conflicts, verification
multi chain interaction, versioning, covenant upgrades

The FSMs are for running these same tools at scale, with network,
in multithread hostile environments, with permanent storage,
but. the logic they use are the execution functions only.

## Ongoing Monitoring

The Engine controls active monitoring of what the latest block is, and it undertakes to resolve the hints it gets about there being new interpulses available for it to process.

This service is not started by default, must be switched on, and must also be shutdown to conclude testing.

If the service is not turned on, then the engine operates in local mode only. In local mode it can have some activity injected into it, and it responds to its own generated events and piercings, but that is all. The service is the network.
