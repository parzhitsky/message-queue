import { type Message, type MessageType } from './message.type.js'

export abstract class Consumer<const out Type extends MessageType, Data> {
  constructor(public readonly messageType: Type) {}

  protected abstract doConsume(message: Message<Type, Data>): void | PromiseLike<void>

  async consume(message: Message<Type, Data>): Promise<void> {
    if (message.type === this.messageType) {
      await this.doConsume(message)
    }
  }
}
