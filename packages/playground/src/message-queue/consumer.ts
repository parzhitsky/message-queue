import { type Closable } from './closable.type.js'
import { type Message, type MessageType } from './message.type.js'

export abstract class Consumer<const out Type extends MessageType, Data> implements Closable {
  protected closed = false

  constructor(public readonly messageType: Type) {}

  protected abstract doConsume(message: Message<Type, Data>): void | PromiseLike<void>

  canConsume(message: Message<MessageType, unknown>): boolean {
    return !this.closed && message.type === this.messageType
  }

  async consume(message: Message<Type, Data>): Promise<void> {
    if (this.closed) {
      throw new ConsumerClosedError(this.messageType)
    }

    if (message.type !== this.messageType) {
      throw new MessageTypeMismatchError(message.type, this.messageType)
    }

    await this.doConsume(message)
  }

  close(): void {
    this.closed = true
  }

  isClosed(): boolean {
    return this.closed
  }
}

export class ConsumerClosedError extends Error {
  constructor(public readonly messageType: MessageType) {
    super(`Consumer "${messageType}" cannot consume as it is closed`)
  }
}

export class MessageTypeMismatchError extends Error {
  constructor(
    public readonly receivedMessageType: MessageType,
    public readonly expectedMessageType: MessageType,
  ) {
    super(`Received message type "${receivedMessageType}" is not equal to expected message type "${expectedMessageType}"`)
  }
}
