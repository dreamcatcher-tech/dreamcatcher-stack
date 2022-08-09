# The Crush System

This collection of classes are designed to break a Pulse down into IPFS compatible chunks, for efficient hashing.

## Requirements

1. use the inheritance of IpldInterface as identifying feature of classes that get crushed
1. crush relies on an unbroken chain of crushable classes from the root down
   1. ie: cannot have a pojo that holds a crush class in it and expect it to work
1. arrays of crush classes follow these rules
1. when flagged, some children may be 'punched out' as CID links, and reinflated back in
1. any tree of classes can be reinflated from ipfs back into classes
1. ipfs blocks representing the different between the previous 'crush' process can be fetched then persisted in ipfs storage
1. be able to directly represent an IPFS primitive as a class, such as a CID - these are needed to signal to the ORM that it should stop rehydration
1. Be able to connect a set of IPLD schemas to the classes, to check them for correctness on crush and uncrush
   1. This check should be disablable for speed
