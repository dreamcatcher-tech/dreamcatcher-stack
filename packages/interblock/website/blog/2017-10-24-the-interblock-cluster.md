---
title: The Interblock Cluster
author: Dreamwalker
authorURL: http://twitter.com/
---

The Interblock cluster consists of four components:

1. The interblock protocol
1. The aws-interblock deployment tool
1. DOS the Dreamcatcher Operating System
1. Terminal: the web browser version of DOS
1. Gorilla1: the first commercial block producer

<!--truncate-->

## Gorilla1

Requirements:

1. Terminal, DOS, aws-interblock, interblock
1. interblock audit
1. aws-interblock audit
1. payment processing in crypto

### primary goal is to get the programmatic interface right, then fortify

so we use AWS for silicon scale, accepting the temporary inconvenience of them being implicitly party to all
activity, and having ultimate control to stop execution

- we don't need to solve this problem to solve the programmability problem
- having a lightweight core lets us adapt rapidly to converge on good programmatic fit
  we can test for scale, programmability, latency - all in the AWS environment
- then we can move on fortifying and making the operation optionally independent of AWS
  using AWS should be no worse for cost, performance, and programmability than current workloads
- once we get off AWS, we should be able to out perform on cost, latency, and capacity
- there are more cpus at home than in AWS
- there are more CPUs outside of AWS than inside it, by quite some way
