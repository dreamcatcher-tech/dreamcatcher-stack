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

###
