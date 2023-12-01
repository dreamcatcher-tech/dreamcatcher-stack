# Goalie Stories

Should make a testing interface that has a bunch of prompts entered, one per
line, and it runs thru them all in sequence when input.

## Multi Goal split

Dave gives a prompt that contains two goals in one, and so the goalie should be
able to break these apart and choose the first one to work on, then switch back
to the other one once it has completed any other goal.

## Goal Stacking

Dave should have multiple goals going concurrently, and a stack would be formed.
An intelligent choice should be made for the next one to figure out on the
stack.

## Stack maintenance

Sometimes achieving one goal will obviate other goals in the stack. The Goalie
should identify when any given goal is now obsolete

## Standardization

Two goals that sound similar should use the same key words to describe each
other. A list of common goals should be maintained so that this affinity can be
enforced.

## Pruning

based on being too old, or being unimportant, goals should get dropped /
archived over time.

## Unknown goal identification

If the user says something that doesn't fit in the current goal, and makes
little sense, it will be inserted into a new thread that will in discovery mode
where it tries to find out wtf the user meant.
