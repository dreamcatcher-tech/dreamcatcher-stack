/**
 * A model of a remote chain.
 * Purpose is:
 *  1. to serve all the full chains we are hosting
 *  2. to purge remote interblocks once they are not needed by any local chains
 *  3. to deduplicate remote sends from sockets
 *  4. trigger full chain blocking when a heavy interblock arrives
 *  5. manage seeking out missing blocks
 */
