# Fast XState

`npm i fast-xstate`
XState interpreter with pure unadultered thread hogging speed

### Philosophy

The XState interpreter simply determines what order to call the user supplied code in, passing context between them all, in response to external events being inserted. This should be an extremely fast and lightweight process, but the current XState implementation carries significant overhead for high performance uses.

Debugging these functions is also difficult as seeing the state of the machine during previous states is hard, and with transient states is near impossible. We need a system that lets us use traditional debugging tools to quickly and clearly see what are the problems with our user supplied code, and in what order things have been called.

### Background

Over the past 18 months, XState has served us immensely well.

However, we have found the implementation lacking for our admitedly very specific needs, which are:

1. As fast as possible execution
1. Tracing by stepping thru all transitions, including transient transitions

When we attempt to reuse the code of the current XState implementation, we are surpised that:

1. Some of the code files are large, making it difficult to decipher
1. None of XState seems to be written in XState

For our application, which is a blockchain that is written almost entirely using XState to manage the complexity of the project, we also have the ability to run XState machines inside of the blockchain itself.

This all begs the question: Can a small core of XState functionality be used to write all the extended functionality of XState in the XState language itself ?

Benefits are:

1. Smaller core code
1. Implementation can leverage the same tools XState applications do, such as visualization, testing
1. Contributors to the project, who will most likely be using XState for their own projects, will immediately understand how the system works
1. Possibly greater speed, with configurable thread hogging capability, when raw speed matters
1. All the tools of XState can be brought to bear on the XState project itself
1. writing the core and using XState become close to the same thing, meaning core developer time is spent more on the usage of XState, making them heavy power users, rather than two separate software disciplines taking place, with core more focused on conventional development, and users more focused on XState language
1. In the visual debugger, can present the underlying state machines, so users can understand what is happening under the hood, and can express bugs easier
1. The mere fact that it runs proves the utility of XState and the correctness of the implementation

## Features provided by a higher order state chart

The HOSC expands on the features of the core by running at the start and at every transition, in effect decorating the core behaviour. Seeing statecharts visually is about the most illuminating thing a programmer could hope for, and so by jumping into statechart land as early as possible, we can gain these benefits for the majority of the XState codebase.

1. invoke
1. parallel states
1. Format checking of machine and config
1. Actors
1. Error checking and handling
1. Transformation of shorthand expressions into core format
1. History
1. Jumping across states using id's
1. Statecharts ? Use core for only flat state machines ?

## Interpreter state chart

This statechart calls the HOSC to do pure transition functions, then it takes the result and executes all the actions, updating the context.

1. Timers
1. start, stop, pause of running interpreter
1. receiving external events

## Could the core be a statechart too ?

Transition to next node, resolve current node, then lob up an action to self to cause the processing of each step ?

In effect, there would be no single program that could execute the core statechart, just something to start the operation, ways to process each node, then actions send to self to move the system forwards.
