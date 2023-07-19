/**
 * @param {string} name Name of the token
 * @param {string} description description of the token
 * @param {string} image link to the image URL
 * @param {Array} attributes The attributes of the token
 * @param {string} external_url The external link of the token
 * @param {string} animation_url Link to the animation such as music, video
 * @param {string} background_color The background color of the token
 * @param {string} youtube_url The youtube url of the token
 */

const template = {
  type: 'DATUM',
  schema: {
    type: 'object',
    required: ['type', 'title', 'image', 'status', 'time'],
    properties: {
      changeId: {
        type: 'integer',
        description: `The id in the the chain`,
      },
      chainId: { type: 'integer', description: `The chain this change is on` },
      type: {
        title: 'Type',
        description: `The type of of the change`,
        enum: ['packet', 'solution', 'header', 'dispute', 'modification'],
      },
      status: {
        title: 'Status',
        enum: [
          'draft',
          'unconfirmed',
          'pending', // in the qa queue
          'disputable',
          'accepted',
          'rejected',
          'disputed',
        ],
      },
      image: {
        type: 'string',
        title: 'Image',
        description: `The image of the Packet this draft targets`,
        faker: 'image.url',
      },
      title: { title: 'Title', type: 'string', faker: 'company.buzzPhrase' },
      funds: {
        type: 'integer',
        title: '$USD',
        minimum: 0,
      },
      description: {
        type: 'string',
        title: 'Description',
        faker: 'git.commitSha',
      },
      contents: {
        type: 'string',
        description: `the ipfs hash of the contents of the packet`,
        faker: 'git.commitSha',
      },
      upstreamId: {
        type: 'integer',
        title: 'Upstream ID',
        description: `Draft headers do not have this.  Draft solutions must have this as the packet they target.  Draft disputes must have this as the header or solution they target.`,
        minimum: 1,
      },
      downstreamIds: {
        type: 'array',
        title: 'Downstream IDs',
        items: { type: 'integer', minimum: 1 },
        uniqueItems: true,
      },
      time: { type: 'integer', title: 'Created', faker: 'date.past' },
    },
  },
  uiSchema: {
    contents: { 'ui:widget': 'hidden' },
    description: { 'ui:widget': 'hidden' },
    upstreamId: { 'ui:widget': 'hidden' },
    downstreamIds: { 'ui:widget': 'hidden' },
    changeId: { 'ui:widget': 'hidden' },
    chainId: { 'ui:widget': 'hidden' },
    status: { 'ui:widget': 'hidden' },
  },
}
Object.freeze(template)
export default template
