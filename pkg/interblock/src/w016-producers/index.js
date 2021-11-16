/**
 * Executions are the condensation of the effect pool
 * and interblock pool into new blocks, and/or new
 * broadcasts of existing blocks.
 *
 * Execution primarily deals with the DMZ against a reducer,
 * the execution of which is the same in all three modes:
 *      1. proposing
 *      2. validating
 *      3. witnessing
 *
 * Execution secondarily deals with the running of side
 * effects.  This is because the loading of a covenant is
 * the same for block making as it is for effects.
 *
 * The execution environment is the only place that malicious
 * 3rd party code can damage the system.
 *
 * Execution forms the metrology toolkit, which tests the
 * interaction of the execution with the models, across all
 * possible chain behaviours that are valid. Behaviours include:
 *    - merging, forking, consensus conflicts, verification
 *    - multi chain interaction, versioning, covenant upgrades
 *
 * The FSMs are for running these same tools at scale, with network,
 * in multithread hostile environments, with permanent storage,
 * but the logic they use are the execution functions only.
 */

export * as networkProducer from './src/networkProducer'
export * as channelProducer from './src/channelProducer'
export * as dmzProducer from './src/dmzProducer'
export * as metaProducer from './src/metaProducer'
export * as blockProducer from './src/blockProducer'
export * as lockProducer from './src/lockProducer'
export * as pendingProducer from './src/pendingProducer'
export * as provenanceProducer from './src/provenanceProducer'
export * as signatureProducer from './src/signatureProducer'
