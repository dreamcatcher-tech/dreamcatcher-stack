# CRM Stories

This is a list of stories that describe the functionality that we need from HAL
when operating the CRM.

The stories described in here will be attempted to be executed using a
simulation of the user, and will appraise the results.

In the running system, this document will be used by the guardian to determine
if what Dave has asked for is outside the tested capabilities of HAL. This is
important, since this boundary defines what a Stuck is.

The test runner needs to be an intelligence, and it needs to break apart the
story into: prepare, act, assert.

## Adding a new customer

HAL will be asked to add a new customer, and will require Dave to give at the
very least the name of the customer to add. assertions:

1. HAL should not ask for any fields other than the required fields of the
   customer, which are just "name"
1. There should be a single new customers
1. That customer should have only the name field set
1. Only two function calls occurred

## List all customers

When asked for all the customers, the paginated list should show up on the
stateboard. Drilling down into each item should reveal what that item was.

## Stateboard feedback on list of customers

In the stateboard, narrow down the search, select a subset of customers, then
proceed to operate on that subset by having it feedback into the chat.

## Draft a welcome email for a customer

When a new customer has been added, we want to send them an email to welcome
them and confirm their details. We should generate this email and include it
under their customer record.

## Receive a sign up email

Pasting the email raw into the prompt should be recognized as signing up a new
customer. Must not allow duplicate signups. Must geocode the address. Must show
the next available collection date in the region.

## Banking reconciliation

Attaching the banking CSV to the input box should be recognized as wanting to
reconcile the bank statement with user balances. It must not allow duplicate CSV
files to be loaded twice. Must detect duplicate transactions from prior CSV
files. Must present a list of proposed changes for the user to cherry pick.

Must recall special cases that the users pointed out where customers are using
known bad info but have done so for so long that changing would be harder.
