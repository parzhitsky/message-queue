import { type Cancellable } from '@/async-iterable-iterator-cancellable/cancellable.type.js'
import { Consumer } from './consumer.js'
import { type MessageType, type MessageTypeOf, type MessageTypeToDataMapAny } from './message.type.js'
import { Producer } from './producer.js'

/** @private */
type ProducerByMessageType<DataMap extends MessageTypeToDataMapAny, Type extends MessageTypeOf<DataMap>> = Producer<Type, DataMap[Type]>

/** @private */
type ConsumerByMessageType<DataMap extends MessageTypeToDataMapAny, Type extends MessageTypeOf<DataMap>> = Consumer<Type, DataMap[Type]>

/** @private */
type MessageTypeToProducerMap<out DataMap extends MessageTypeToDataMapAny> = {
  [Type in MessageTypeOf<DataMap>]: ProducerByMessageType<DataMap, Type>
}

/** @private */
class ConsumerRegistration {
  constructor(protected readonly cancellable: Cancellable) {}

  cancel(): void {
    this.cancellable.cancel()
  }
}

export class Broker<const out DataMap extends MessageTypeToDataMapAny> {
  protected readonly messageTypeToProducerMap = Object.create(null) as MessageTypeToProducerMap<DataMap>
  protected readonly consumerRegistrations: ConsumerRegistration[] = []

  protected getProducer<const Type extends MessageTypeOf<DataMap>>(messageType: Type): ProducerByMessageType<DataMap, Type> | undefined {
    return this.messageTypeToProducerMap[messageType]
  }

  protected getOrCreateProducer<const Type extends MessageTypeOf<DataMap>>(messageType: Type): ProducerByMessageType<DataMap, Type> {
    return this.messageTypeToProducerMap[messageType] ??= new Producer<Type, DataMap[Type]>(messageType)
  }

  registerConsumer<const Type extends MessageTypeOf<DataMap>>(consumer: ConsumerByMessageType<DataMap, Type>): ConsumerRegistration {
    const messages = this.getOrCreateProducer(consumer.messageType).messages()
    const registration = new ConsumerRegistration(messages)

    this.consumerRegistrations.push(registration)

    Promise.resolve().then(async () => {
      for await (const message of messages) {
        consumer.consume(message)
      }
    })

    return registration
  }

  produce<const Type extends MessageTypeOf<DataMap>>(messageType: Type, data: DataMap[Type]): void {
    this.getOrCreateProducer(messageType).produce(data)
  }

  closeProducer<const Type extends MessageTypeOf<DataMap>>(messageType: Type): void {
    this.getProducer(messageType)?.close()
  }

  stop(): void {
    for (const registration of this.consumerRegistrations) {
      registration.cancel()
    }

    for (const producer of Object.values(this.messageTypeToProducerMap)) {
      producer.close()
    }
  }
}
