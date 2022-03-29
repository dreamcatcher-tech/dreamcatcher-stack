/**
 * Represents a link to a Pulse, so that uncrush does not inflate the
 * whole chain in a Tx object.
 */

import { IpldInterface } from './IpldInterface'

export class PulseLink extends IpldInterface {}
