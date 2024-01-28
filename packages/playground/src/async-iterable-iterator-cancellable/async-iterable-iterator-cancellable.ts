import { defer } from '@/defer/defer.js'
import { type Cancellable } from './cancellable.type.js'

/** @private */
type Cancellation = IteratorReturnResult<undefined>

/** @private */
const cancellation = { done: true } as Cancellation

export class AsyncIterableIteratorCancellable<const out Value> implements AsyncIterableIterator<Value>, Cancellable {
  protected readonly cancellationDeferred = defer<Cancellation>()

  constructor(protected readonly iterator: AsyncIterableIterator<Value>) {}

  [Symbol.asyncIterator](): this {
    return this
  }

  async next(): Promise<IteratorResult<Value, undefined>> {
    const value = await Promise.race([this.iterator.next(), this.cancellationDeferred])

    if (value.done) {
      this.iterator.return?.()
    }

    return value
  }

  cancel(): void {
    this.cancellationDeferred.resolve(cancellation)
  }
}
