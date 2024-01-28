/** @private */
interface Entry<Value> {
  readonly value: Value
}

export interface Dequeued<Value> extends Entry<Value> {}

export class Queue<Item> {
  protected readonly entries: Entry<Item>[] = []
  protected nextIndex = 0
  private cleanupScheduled = false

  isEmpty(): boolean {
    return this.nextIndex >= this.entries.length
  }

  enqueue(item: Item): void {
    this.entries.push({ value: item })
  }

  protected cleanup(): void {
    if (this.nextIndex !== 0) {
      this.entries.splice(0, this.nextIndex) // https://jsperf.app/qimuwu
      this.nextIndex = 0
    }
  }

  private maybeScheduleNewCleanup(): void {
    if (this.cleanupScheduled) {
      return
    }

    setImmediate(() => {
      this.cleanup()
      this.cleanupScheduled = false
    })

    this.cleanupScheduled = true
  }

  protected peakNextEntry(): Entry<Item> | null {
    const next = this.entries.at(this.nextIndex) // using `.at(…)` to get uncertainty

    return next ?? null
  }

  dequeue(): Dequeued<Item> | null {
    if (this.isEmpty()) {
      this.maybeScheduleNewCleanup()

      return null
    }

    const next = this.peakNextEntry()!

    this.nextIndex += 1

    return {
      value: next.value,
    }
  }
}
