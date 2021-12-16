/**
 * The models module in w015 is the only place that json gets dealt with anywhere in the system.
 * This is the persistence layer, which implies consistency.
 * The logic of the blockchains is maintained by the models and how they connect togeher.
 * The models endeavour to spread the logic around so each unit is simple.
 *
 * The type system has these rules:
 *      1. Only one circular reference is allowed - interblocks and blocks
 *      2. Whenever a model is passed as a parameter, clone it to ensure fidelity
 *      3. Only signatures cannot be created on their own
 *      4. Arrays can only have items of a single type
 *      5. Only one level of properties are allowed in each type
 *      6. It is not possible to instantiate a model that is not correct (crypto and format and logic all passes)
 *      7. if a type is nested, the key in the parent should be the same as that type
 *      8. there are no optional properties in the schemas
 *      9. no passthru function calls
 *      10. everything is required - no optional properties
 *      11. never attempt to make objects raw and then clone them - makes for brittle tests
 *      12. as soon as data enters the system, make it a model so it has logic integrity asap
 *
 *
 * All model objects are:
 *      1. checked for consistency and correctness against a schema, and logic checks
 *      2. versioned against the software version they run under
 *      3. serialized and unserialized
 *      4. clonable
 *      5. able to make a default version of themselves with no parameters
 *      6. made immutable, which lends to caching
 *      7. all models are tamper evident, as much as they are able
 *
 * Types of model:
 *      Actions:
 *          The fundamental event of the system.  Actions are processed into blocks.
 *          Actions are contained within Effects and Blocks
 *      Blocks:
 *          The fundamental state of the system.
 *          Signed by the system.
 *      Effects:
 *          The way new information enters the blockchain network.
 *          Effects are processed in to blocks.
 *  *
 * Models are exclusively dealt with by the service layer, to communicate with the DSLs.
 * Model objects completely decouple the execution code from the data structures.
 * Allows rapid model changes and format changes without changing
 * every code path where the raw object is accessed.
 * Allows convenience to cause layout, not format requirements and crypto requirements.
 * Models are serialized, transmitted, then reconstructed on the other end.
 * Models can detect corruption, either malicious, benign, or programmatic.
 * Provides accessors to the Model, so that the format structure can change, but access is constant.
 * Substructures can be set up within the models, to allow nesting, eg: actions in blocks,
 * or actions in envelopes.
 * Models are cryptoaware and can check and sign signatures.
 * Models can generate their next iteration, such as generating the next block.
 * Will be used to generate imagery of block model structure.
 * Allows jsdoc comments over the methods to explain the block structure
 * and why you would need parts of the block.
 * Serialized size limits and model size limits can be enforced.
 * Easy defaults are generated to speed up testing.
 *
 * Models capture all the rules about a particular type of object in the system.
 * They make methods relevant to operating on their type of object.
 * They allow otherwise complicated types to be made simple through composition.
 *
 * Make a list of all models, and somehow generate a dependency graph of them all ?
 * Figure out the common functions between all of them ?
 * ? Runtime registry of objects by hash ??
 * ? subtypes of each model ?
 *      modelCreators used to make subtypes
 */

export * from './src/classes'
// export * from './src/queues'
export * from './src/transients'
