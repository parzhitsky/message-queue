import { AsyncIterableIteratorCancellable } from '@/async-iterable-iterator-cancellable/async-iterable-iterator-cancellable.js'
import { defer } from '@/defer/defer.js'
import { type Dequeued, Queue } from '@/queue/queue.js'
import { type Message, type MessageType } from './message.type.js'
import { type Closable } from './closable.type.js'

export class Messages<const out Type extends MessageType, Data>
  extends AsyncIterableIteratorCancellable<Message<Type, Data>> {}

export class Producer<const out Type extends MessageType, Data> implements Closable {
  protected readonly dataQueue = new Queue<Data>()
  protected hasData = defer<boolean>()
  protected closed = false

  constructor(public readonly messageType: Type) {}

  isClosed(): boolean {
    return this.closed
  }

  close() {
    if (this.closed) {
      return
    }

    this.closed = true
    this.hasData = defer() // if the messages are being consumed, `.close(…)` only has effect after the queue is empty
    this.hasData.resolve(false)
  }

  produce(data: Data): void {
    if (this.isClosed()) {
      throw new ProducerClosedError(this.messageType)
    }

    this.dataQueue.enqueue(data)
    this.hasData.resolve(true)
  }

  protected async *iterate(): AsyncIterableIterator<Message<Type, Data>> {
    while (await this.hasData) {
      this.hasData = defer()

      let dequeued: Dequeued<Data> | null

      while (dequeued = this.dataQueue.dequeue()) {
        yield {
          type: this.messageType,
          data: dequeued.value,
        }
      }
    }
  }

  messages(): Messages<Type, Data> {
    const messagesIterator = this.iterate()
    const messages = new Messages(messagesIterator)

    return messages
  }
}

export class ProducerClosedError extends Error {
  constructor(public readonly messageType: MessageType) {
    super(`Producer "${messageType}" cannot produce as it is closed`)
  }
}
