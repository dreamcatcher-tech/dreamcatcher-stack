import { MerkleArray } from './MerkleArray'

/**
 * The transmissions of the current block.
 * Generated inside of the Network object.
 * Used to allow more focused queries against a block to determine
 * which channels are transmitting.
 * Makes the proofs for interblocks smaller in tranmission size.
 * Can be ignored from meta updates being pushed to parent, since
 * we always know it will be deleted in the next block, so no need
 * to report this change up the tree higher, as the transmission change
 * would already be reflected in the channel precedent being updated.
 *
 * The case for this object is weak, but it sure does make for easy
 * programming, with negigible data repetition, and some fringe benefits.
 */
class Tx {
  #channels = new MerkleArray()
  // arrange the txs as an array so proof generation is compact
}
