---
id: caveats
title: Caveats
sidebar_label: Example Page
---

## Repeated actions

Sometimes your actions might be repeated

## independence of actions

We guarantee channel order, but keep channels independent as we might want to do multi processing

## Intentional exclusion from reducers

### When the block cycle is ending

No knowledge of when the block is ending
Introduces entropy
Breaks independence between actions, which we reserve for parallel processing

### Path opening

1. Path opening might be in progress during a fork, so the requested chainId will be different
1. Path resolution might be in progress and the directory tree shifts requiring restarting of the walk
