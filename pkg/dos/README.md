# DOS

The Dreamcatcher Operating System

This package is a terminal application that uses GPT4+ to be the presentation layer of an underlying blockchain application.  The natural language is interpreted and sometimes a system level action is enacted.  The tree of the chain system provides natural scoping for the system.  The bot is able to modify the api and the code within the covenants using a rigorous process with many checks.

If the user types in an instruction that is exactly a command in the filesystem, they can cause it to execute directly using shift+enter, otherwise the input will go to gpt4 for interpretation.

The API of each blockchain object is supplied to the AI, and it decides if it would like to call any of these functions.  The calls can be virtualized so that the output can be fed back to the AI during long running sequences, so that the AI can verify that what the change it got at the end was indeed the change it wanted.

By modifying its own filesystem structure and composition, it can reprogram itself either under human direction or by identifying a shortcoming in its service to the human.

In this way, the pain of precision required to interact with an application is avoided, and new users are instantly expert users, if they can describe clearly what they want to happen.  The jump to a gui powered web app is very small compared to this base interface interaction.  The UI would merely present a stateboard where more information could be presented, but underneath, the commandline style interface is still present.

## Embeddings
Each object generates its own set of embeddings all the time, whenever it changes.  These embeddings are available to be searched quickly using a local cache to find objects of good similarity.  This permits commands to be called even if the current path is not the same.  The path acts as a focus indicator, and when the topics switch, the AI takes care of navigating to the most relevant area and showing relevant information.

## Commands 
Autocomplete is AI assisted where it tries to guess what you were going to say using a fast model.  It populates the stateboard with a summary of what that command would do in the current context.  It executes all plausible commands eagerly, in virtual mode, then summarizes and shows the results back to the user.  The AI may have deeply inspected the results thru several iterations to assess what is going on.

Monetization has occured in the problems with user interfaces, such as shazam not offering the pure utility of opening music in youtube music.  AI interfaces can extract pure value and refuse any corruptions.

Merge based operation takes what the user wants to insert, regenerates it based on all inputs, and verifies that the output matches.  Then it does a merge based on whatever the current state is.  It can reject when there are conflicts or it can attempt to heal them.  So the patch is generated using actions, but the patch is merged using clobber.

Each time it interprets your command, it executes the system command, and shows you what it was, in case you want to do it yourself next time, or so you understand what the system is doing, and what functions have been invoked.

Surface the discovery process the bot is going thru.  As it CD's around to get the next context, give a oneliner to show its background thinking, like how it is feeling, almost, so you can see it dig down a particular path, then backtrack, then ultimately arrive on what it thinks is best.  Show these thoughts happening in parallel.  have commical insertions like "hmm that's not quite it..." as it ponders around the place.

When displaying results, such as `ls` types of commands, the stateboard makes use of standard list components by doing a UI pass.  It generates the props that the component needs, then shows it appropriately.  Eg: a grid component for LS commands is the right thing to use.  But the grid component only needs to be built once, and the UI AI pass does the rest.  The fluidity allows the UI subsystem to tweak and tune, and store preferences that the user wanted saved.

`savePreferences` function can be seen to execute and saves the AIs summary of the preference you just asked to save.  From here on, the preferences checker will engage a corrective loop to change the output, so that no matter what the preferences size is, they will always be honoured.  Allows a great focusing of the context window.  At each stage like this, we should be able to drill in and see what was directly asked of the AI, after all the filters and context prep was done.

The last known artefact is the CLI - everyone is used to this.  The UI is also familiar, so we show that too.  WhatsApp is a familiar way to pass on instructions.

## Approach
Make an ink based terminal app to use DOS, but aim to lift into a browser app that uses the same core app covenant, using React components to emulate the features of the terminal, but include a React rendered stateboard.

Stateboard elements should have the same props that the AI can control, so we can make terminal and web versions and give the AI the same controls over them.

## Notes
It should have a strategy that can rean man pages, looking for what info it wants, and following the instructions when it finds them.  Then run experiments, taking notes as it goes.  Strategies that worked are marked as such and are available to other bots to search based on an embedding of a summary of what the user wanted to do.  Would do repeated checks like get the status of the current system, then figure out what changes to make, start a sandbox to test in (use docker images to fork or something - if blockchain, then have this naturally) then apply the changes and compare results.  Track progress, and if think we're drifting, reset and try a different approach, where different approach is based on the record of what approaches were tried.  Approaches are updated and earlier ones can be rewritten when later learnings become important.  This is where the diffing or changes are important as it can have a mini form of AI native git that it can understand its past with.

Embeddings make a great DHT since the bot knows if the embedding is false when it gets to it.

## Controlling hotkeys
Tell the system what to do when certain hotkeys are entered, and have it wire things up so that when you hit the hotkey, a piece of code will execute, without making a call to the intelligence.  So the AIs job is to catch anything that doesn't match what the blockchain app requires, including common mispellings, and to turn anything it catches into something in the blockchain app, so next time it is faster for both human and machine.

## Macros
Set laptop lid to do nothing when closed.  Lets user configure macros and under the effect of several changes all bundled together with a simple natural interface.  AI overcomes the interface challenges of any application where you cannot give people a single action to do a combination of things since you balance brevity of interface with directness of action.  With AL you can have it all.