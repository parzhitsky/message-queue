import { Consumer } from './consumer.js'
import { type MessageTypeOf, type MessageTypeToDataMapAny } from './message.type.js'
import { type Messages, Producer } from './producer.js'

/** @private */
type ProducerByDataMap<
  DataMap extends MessageTypeToDataMapAny,
  Type extends MessageTypeOf<DataMap> = MessageTypeOf<DataMap>,
> =
  Producer<Type, DataMap[Type]>

/** @private */
type ConsumerByDataMap<
  DataMap extends MessageTypeToDataMapAny,
  Type extends MessageTypeOf<DataMap> = MessageTypeOf<DataMap>,
> =
  Consumer<Type, DataMap[Type]>

/** @private */
type MessagesByDataMap<
  DataMap extends MessageTypeToDataMapAny,
  Type extends MessageTypeOf<DataMap> = MessageTypeOf<DataMap>,
> =
  Messages<Type, DataMap[Type]>

export class Broker<const DataMap extends MessageTypeToDataMapAny> {
  protected readonly producers: ProducerByDataMap<DataMap>[] = []
  protected readonly consumers: ConsumerByDataMap<DataMap>[] = []
  protected readonly messagesLists = new WeakMap<ProducerByDataMap<DataMap>, MessagesByDataMap<DataMap>[]>()

  protected getMessagesList<const Type extends MessageTypeOf<DataMap>>(producer: ProducerByDataMap<DataMap, Type>): MessagesByDataMap<DataMap, Type>[] | null {
    const messagesList = this.messagesLists.get(producer) as MessagesByDataMap<DataMap, Type>[] | undefined

    return messagesList ?? null
  }

  protected getOrCreateMessagesList<const Type extends MessageTypeOf<DataMap>>(producer: ProducerByDataMap<DataMap, Type>): MessagesByDataMap<DataMap, Type>[] {
    if (!this.messagesLists.has(producer)) {
      this.messagesLists.set(producer, [])
    }

    const messagesList = this.getMessagesList(producer)!

    return messagesList
  }

  addProducer<const Type extends MessageTypeOf<DataMap>>(producer: ProducerByDataMap<DataMap, Type>): this {
    this.producers.push(producer)

    return this
  }

  addConsumer<const Type extends MessageTypeOf<DataMap>>(consumer: ConsumerByDataMap<DataMap, Type>): this {
    this.consumers.push(consumer)

    return this
  }

  removeProducer(producer: ProducerByDataMap<DataMap>): void {
    const index = this.producers.indexOf(producer)

    if (index === -1) {
      return
    }

    this.producers.splice(index, 1)

    const messagesList = this.getMessagesList(producer)

    for (const messages of messagesList ?? []) {
      messages.cancel()
    }

    this.messagesLists.delete(producer)
  }

  removeConsumer(consumer: ConsumerByDataMap<DataMap>): void {
    const index = this.consumers.indexOf(consumer)

    if (index !== -1) {
      this.consumers.splice(index, 1)
    }
  }

  protected async broadcastMessages(messages: MessagesByDataMap<DataMap>): Promise<void> {
    for await (const message of messages) {
      for (const consumer of this.consumers) {
        if (consumer.canConsume(message)) {
          consumer.consume(message)
        }
      }
    }
  }

  start(): this {
    for (const producer of this.producers) {
      const messages = producer.messages()

      this.getOrCreateMessagesList(producer).push(messages)
      this.broadcastMessages(messages)
    }

    return this
  }

  stop(): void {
    for (const producer of this.producers) {
      this.removeProducer(producer)
    }

    for (const consumer of this.consumers) {
      this.removeConsumer(consumer)
    }
  }
}
