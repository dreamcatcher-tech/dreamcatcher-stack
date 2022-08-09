## Problem Areas

Areas where a problem is not clear cut, where an approach feels a bit sticky, or sloppy.

### Ballooning request types

In `src/w008-ipld/src/Request.js` in the array `SYSTEM_TYPES`, every time we want a new system action, this list grows. This keeps growing because in order to allow the system reducer to be written using replayable async functions, we need to make each request that interacts with the current pulse state be an independent one of action. We cannot replay the change, but we can replay the result. We also can never insert the full latest pulse as part of the response or else the tree size will balloon, so we need to send back a summary, hence the reason for an independent request type for each 'thing' we want to do.

Something feels a bit odd about this, however the current approach is still very much better than any other attempted so far.
