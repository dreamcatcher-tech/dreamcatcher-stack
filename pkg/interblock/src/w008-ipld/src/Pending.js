import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
import { RxRequest, AsyncRequest } from '.'
/**
    type RequestId struct {
        channelId Int
        stream String
        requestIndex Int
    }
    type AsyncRequest struct {
        request &Request
        to String
        id RequestId
        settled optional &Reply
    }
    type RxRequest struct {
        request &Request
        requestId RequestId
    }
    type Pending struct {
        origin RxRequest
        settles [AsyncRequest]
        txs [AsyncRequest]
    }
 */
export class Pending extends IpldStruct {
  static create(origin, settles, txs) {
    assert(origin instanceof RxRequest)
    assert(Array.isArray(settles))
    assert(settles.every((tx) => tx instanceof AsyncRequest))
    assert(settles.every((tx) => tx.isSettled()))
    assert(Array.isArray(txs))
    assert(txs.every((tx) => tx instanceof AsyncRequest))
    assert(txs.every((tx) => !tx.isSettled()))
    return super.clone({ origin, txs, settles })
  }
}
