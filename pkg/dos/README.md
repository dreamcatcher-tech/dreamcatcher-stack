# DOS

The Dreamcatcher Operating System

This package is a terminal application that uses GPT4+ to be the presentation layer of an underlying blockchain application.  The natural language is interpreted and sometimes a system level action is enacted.  The tree of the chain system provides natural scoping for the system.  The bot is able to modify the api and the code within the covenants using a rigorous process where with many checks.

If the user types in an instruction that is exactly a command in the filesystem, they can cause it to execute directly using shift+enter, otherwise the input will go to gpt4 for interpretation.

The API of each blockchain object is supplied to the AI, and it decides if it would like to call any of these functions.  The calls can be virtualized so that the output can be fed back to the AI during long running sequences, so that the AI can verify that what the change it got at the end was indeed the change it wanted.

By modifying its own filesystem structure and composition, it can reprogram itself either under human direction or by identifying a shortcoming in its service to the human.

In this way, the pain of precision required to interact with an application is avoided, and new users are instantly expert users, if they can describe clearly what they want to happen.  The jump to a gui powered web app is very small compared to this base interface interaction.  The UI would merely present a stateboard where more information could be presented, but underneath, the commandline style interface is still present.

Each object generates its own set of embeddings all the time, whenever it changes.  These embeddings are available to be searched quickly using a local cache to find objects of good similarity.  This permits commands to be called even if the current path is not the same.  The path acts as a focus indicator, and when the topics switch, the AI takes care of navigating to the most relevant area and showing relevant information.

Autocomplete is AI assisted where it tries to guess what you were going to say using a fast model.  It populates the stateboard with a summary of what that command would do in the current context.

Each time it interprets your command, it executes the system command, and shows you what it was, in case you want to do it yourself next time, or so you understand what the system is doing, and what functions have been invoked.

Surface the discovery process the bot is going thru.  As it CD's around to get the next context, give a oneliner to show its background thinking, like how it is feeling, almost, so you can see it dig down a particular path, then backtrack, then ultimately arrive on what it thinks is best.  Show these thoughts happening in parallel.  have commical insertions like "hmm that's not quite it..." as it ponders around the place.

When displaying results, such as `ls` types of commands, the stateboard makes use of standard list components by doing a UI pass.  It generates the props that the component needs, then shows it appropriately.  Eg: a grid component for LS commands is the right thing to use.  But the grid component only needs to be built once, and the UI AI pass does the rest.  The fluidity allows the UI subsystem to tweak and tune, and store preferences that the user wanted saved.

`savePreferences` function can be seen to execute and saves the AIs summary of the preference you just asked to save.  From here on, the preferences checker will engage a corrective loop to change the output, so that no matter what the preferences size is, they will always be honoured.  Allows a great focusing of the context window.  At each stage like this, we should be able to drill in and see what was directly asked of the AI, after all the filters and context prep was done.

The last known artefact is the CLI - everyone is used to this.  The UI is also familiar, so we show that too.  WhatsApp is a familiar way to pass on instructions.
