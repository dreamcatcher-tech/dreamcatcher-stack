## The Pulse making cycle

> Execution in the isolated environment must be independent of storage latency
> For example, if the Network object is large, and during isolation the covenant requested some piece of the network, then isolated execution would be affected by storage latency.

This is currently avoided by deferring all storage operations until after the isolated execution run has completed.

Making queries about your own state or your previous state is covered by the query interface, and can cross block boundaries if your validator so chooses.
