import { createInterface } from 'readline'
import { entriesOf } from '@@shared/entries-of/entries-of.js'
import { random } from '@@shared/random/random.js'
import { randomChoice } from '@@shared/random/random-choice.js'
import { Broker } from './message-queue/broker.js'
import { Consumer } from './message-queue/consumer.js'
import { type Message } from './message-queue/message.type.js'
import { Producer } from './message-queue/producer.js'

type Warehouse = Record<string, number>

function logWarehouse(warehouse: Warehouse): void {
  console.table([warehouse])
}

function cleanWarehouse(warehouse: Warehouse): string {
  let shelvesToClean = 0
  let shelvesCleaned = 0

  for (const [item, quantity] of entriesOf(warehouse)) {
    if (quantity === 0) {
      shelvesToClean += 1

      // not a perfect clean up
      if (random() < 0.8) {
        delete warehouse[item]

        shelvesCleaned += 1
      }
    }
  }

  const efficacy = shelvesToClean ? shelvesCleaned / shelvesToClean : 1
  const message = `Cleaned ${shelvesCleaned} shelves out of ${shelvesToClean}; efficacy: ${efficacy}`

  return message
}

function isWarehouseClean(warehouse: Warehouse): boolean {
  for (const [, quantity] of entriesOf(warehouse)) {
    if (quantity === 0) {
      return false
    }
  }

  return true
}

const enum InspectionStatus {
  Passed = 'Passed',
  Failed = 'Failed',
}

interface Inspection {
  readonly inspector: WarehouseInspector
  readonly warehouse: Warehouse
  readonly timestamp: number
  readonly status: InspectionStatus
}

class WarehouseInspector {
  protected static readonly instances = Object.create(null) as Record<string, WarehouseInspector>

  static getByName(name: string): WarehouseInspector {
    return this.instances[name] ??= new WarehouseInspector(name)
  }

  protected constructor(protected readonly name: string) {}

  inspect(warehouse: Warehouse): Inspection {
    return {
      inspector: this,
      warehouse,
      timestamp: Date.now(),
      status: isWarehouseClean(warehouse) ? InspectionStatus.Passed : InspectionStatus.Failed,
    }
  }
}

const warehouse: Warehouse = {}

type WarehouseOperation = { operation: 'add' | 'remove', item: string, quantity: number }
type PrepareOperation = { operation: 'prepare' }
type InspectOperation = { operation: 'inspect', inspectorName: string }

type InspectionOperation =
  | PrepareOperation
  | InspectOperation

const enum MessageType {
  Warehouse = 'Warehouse',
  Inspection = 'Inspection',
}

class WarehouseOperationProducer extends Producer<MessageType.Warehouse, WarehouseOperation> {}

class InspectionOperationProducer extends Producer<MessageType.Inspection, InspectionOperation> {}

class WarehouseOperationConsumer extends Consumer<MessageType.Warehouse, WarehouseOperation> {
  protected override doConsume(message: Message<MessageType.Warehouse, WarehouseOperation>): void {
    const { operation, item, quantity } = message.data

    warehouse[item] ??= 0

    switch (operation) {
      case 'add':
        warehouse[item] += quantity
        break

      case 'remove':
        warehouse[item] -= Math.min(quantity, warehouse[item])
        break
    }

    logWarehouse(warehouse)
  }
}

class InspectionOperationConsumer extends Consumer<MessageType.Inspection, InspectionOperation> {
  protected override doConsume(message: Message<MessageType.Inspection, InspectionOperation>): void {
    switch (message.data.operation) {
      case 'prepare':
        console.log(cleanWarehouse(warehouse))
        logWarehouse(warehouse)
        break

      case 'inspect':
        console.log(
          WarehouseInspector
            .getByName(message.data.inspectorName)
            .inspect(warehouse)
        )
        break
    }
  }
}

const warehouseOperationProducer = new WarehouseOperationProducer(MessageType.Warehouse)
const inspectionOperationProducer = new InspectionOperationProducer(MessageType.Inspection)
const warehouseOperationConsumer = new WarehouseOperationConsumer(MessageType.Warehouse)
const inspectionOperationConsumer = new InspectionOperationConsumer(MessageType.Inspection)

type DataMap = {
  [MessageType.Warehouse]: WarehouseOperation
  [MessageType.Inspection]: InspectionOperation
}

const broker = new Broker<DataMap>()
  .addProducer(warehouseOperationProducer)
  .addProducer(inspectionOperationProducer)
  .addConsumer(warehouseOperationConsumer)
  .addConsumer(inspectionOperationConsumer)
  .start()

// ***

const items = ['apple', 'orange', 'lemon', 'strawberry', 'cherry'] as const
const inspectorNames = ['Alice', 'Bob', 'Charlie'] as const

enum CliCommand {
  Quit = '.q',
  Unregister = '.u',
  Log = '.l',
  Add = 'a',
  Remove = 'r',
  Prepare = 'p',
  Inspect = 'i',
}

const cli = createInterface({
  input: process.stdin.setRawMode(true),
  output: process.stdout,
  prompt: '> ',
  completer(line: string) {
    return [Object.values(CliCommand), line]
  },
})

cli.prompt()

loop:
for await (const line of cli) {
  const command = line.trim()
  const item = randomChoice(items)
  const quantity = Math.round(random(1, 20))

  switch (command) {
    case CliCommand.Quit:
      broker.stop()
      break loop

    case CliCommand.Unregister:
      broker.removeConsumer(inspectionOperationConsumer)
      break

    case CliCommand.Log:
      logWarehouse(warehouse)
      break

    case CliCommand.Add:
      warehouseOperationProducer.produce({
        operation: 'add',
        item,
        quantity,
      })
      break

    case CliCommand.Remove:
      warehouseOperationProducer.produce({
        operation: 'remove',
        item,
        quantity: Math.min(quantity, warehouse[item] ?? 0),
      })
      break

    case CliCommand.Prepare:
      inspectionOperationProducer.produce({
        operation: 'prepare',
      })
      break

    case CliCommand.Inspect:
      inspectionOperationProducer.produce({
        operation: 'inspect',
        inspectorName: randomChoice(inspectorNames),
      })
      break

    default:
      console.log(`Unsupported command: ${command}`)
      break
  }

  setImmediate(() => cli.prompt())
}
