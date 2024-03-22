import { Consumer } from './consumer.js'
import { type MessageTypeOf, type MessageTypeToDataMapUnknown } from './message.type.js'
import { type Messages, Producer } from './producer.js'

/** @private */
type ProducerByDataMap<
  DataMap extends MessageTypeToDataMapUnknown,
  Type extends MessageTypeOf<DataMap> = MessageTypeOf<DataMap>,
> =
  Producer<Type, DataMap[Type]>

/** @private */
type ConsumerByDataMap<
  DataMap extends MessageTypeToDataMapUnknown,
  Type extends MessageTypeOf<DataMap> = MessageTypeOf<DataMap>,
> =
  Consumer<Type, DataMap[Type]>

/** @private */
type MessagesByDataMap<
  DataMap extends MessageTypeToDataMapUnknown,
  Type extends MessageTypeOf<DataMap> = MessageTypeOf<DataMap>,
> =
  Messages<Type, DataMap[Type]>

export class Broker<const DataMap extends MessageTypeToDataMapUnknown> {
  protected readonly producers: ProducerByDataMap<DataMap>[] = []
  protected readonly consumers: ConsumerByDataMap<DataMap>[] = []
  protected readonly messagesLists = new WeakMap<ProducerByDataMap<DataMap>, MessagesByDataMap<DataMap>[]>()
  protected started = false

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

  /**
   * Cancels and deletes all message broadcasting for the given producer, if any.
   */
  protected stopProducer(producer: ProducerByDataMap<DataMap>): void {
    const messagesList = this.getMessagesList(producer)

    if (messagesList == null) {
      return
    }

    const messagesListDeleted = messagesList.splice(0, messagesList.length)

    for (const messages of messagesListDeleted) {
      messages.cancel()
    }
  }

  /**
   * Stops all message broadcasting (if any) and removes the producer.
   */
  removeProducer(producer: ProducerByDataMap<DataMap>): void {
    const index = this.producers.indexOf(producer)

    if (index !== -1) {
      this.producers.splice(index, 1)
    }

    this.stopProducer(producer)
  }

  removeConsumer(consumer: ConsumerByDataMap<DataMap>): void {
    const index = this.consumers.indexOf(consumer)

    if (index !== -1) {
      this.consumers.splice(index, 1)
    }
  }

  /**
   * Iterates over all consumers, feeds a given message to consumers which can consume it.
   */
  protected async broadcastMessages(messages: MessagesByDataMap<DataMap>): Promise<void> {
    for await (const message of messages) {
      for (const consumer of this.consumers) {
        if (consumer.canConsume(message)) {
          consumer.consume(message)
        }
      }
    }
  }

  /**
   * Iterates over all producers, broadcasts their messages to corresponding consumers.
   * The operation is idempotent; starting an already started broker is a no-op.
   */
  start(): this {
    if (!this.started) {
      for (const producer of this.producers) {
        const messages = producer.messages()

        this.getOrCreateMessagesList(producer).push(messages)
        this.broadcastMessages(messages)
      }
    }

    this.started = true

    return this
  }

  /**
   * Stops all message broadcasting, if any
   */
  stop(): void {
    for (const producer of this.producers) {
      this.stopProducer(producer)
    }

    this.started = false
  }
}
