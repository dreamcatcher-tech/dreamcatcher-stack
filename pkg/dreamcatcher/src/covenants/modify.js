/**
 * JSON Schema of the state of a modification change.
 */

const modify = {
  type: 'object',
  description: `A Change that would modify an existing Change.
    
    Can have multiple parents, like a git commit.
    Such lineage is stored in the chain lineage.`,
  properties: {},
}
