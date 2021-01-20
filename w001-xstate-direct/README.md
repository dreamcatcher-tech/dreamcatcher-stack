# Fast XState

`npm i fast-xstate`
XState interpreter with pure unadultered thread hogging speed

### Philosophy

The XState interpreter simply determines what order to call the user supplied code in, based on external events being inserted. This should be an extremely fast and lightweight process, but the current XState implementation carries significant overhead for high performance uses.

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
