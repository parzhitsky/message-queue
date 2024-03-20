import { type Message, type MessageType } from './message.type.js'

export abstract class Consumer<const out Type extends MessageType, Data> {
  constructor(public readonly messageType: Type) {}

  protected abstract doConsume(message: Message<Type, Data>): void | PromiseLike<void>

  canConsume(message: Message<MessageType, unknown>): boolean {
    return message.type === this.messageType
  }

  async consume(message: Message<Type, Data>): Promise<void> {
    if (message.type !== this.messageType) {
      throw new MessageTypeMismatchError(message.type, this.messageType)
    }

    await this.doConsume(message)
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
