const api = {
  approve: {
    type: 'object',
    title: 'APPROVE',
    description: `Approve the given customer ids for this sector`,
    required: ['approved'],
    additionalProperties: false,
    properties: {
      approved: {
        type: 'array',
        title: 'Approved',
        uniqueItems: true,
        items: { type: 'string' },
        minItems: 1,
        description: `The customer ids to approve, which must be
            currently unapproved`,
      },
    },
  },
}
