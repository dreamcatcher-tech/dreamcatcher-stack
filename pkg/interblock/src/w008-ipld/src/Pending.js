import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
import { RxRequest } from '.'
/**
type RequestId struct {
    channelId Int
    stream String
    requestIndex Int
}
type PendingRequest struct {
    request &Request
    to String
    id RequestId
    settled optional &Reply
}
type PendingReply struct {
    reply &Reply
    id RequestId
}
type PendingTx union {
    | PendingRequest "request"
    | PendingReply "reply"
} representation keyed
type RxRequest struct {
    request &Request
    requestId RequestId
}
type Pending struct {
    origin RxRequest
    pendingTxs [PendingTx]
}
 */
export class Pending extends IpldStruct {
  static create(origin) {
    assert(origin instanceof RxRequest)
    return super.clone({ origin, pendingTxs: [], replies: [] })
  }
}
