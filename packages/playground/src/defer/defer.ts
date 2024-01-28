/** @private */
interface PromiseResolver<Value> {
  (value: Value | PromiseLike<Value>): void
}

/** @private */
interface PromiseRejector {
  (reason?: any): void
}

/** @private */
const enum DeferredStatus {
  Rejected = 'Rejected',
  Resolved = 'Resolved',
}

export class Deferred<Value> extends Promise<Value> {
  static get [Symbol.species]() {
    return Promise
  }

  protected readonly resolver: PromiseResolver<Value>
  protected readonly rejector: PromiseRejector
  protected status?: DeferredStatus

  constructor() {
    let resolver!: PromiseResolver<Value>
    let rejector!: PromiseRejector

    super((...args) => {
      [resolver, rejector] = args
    })

    this.resolver = resolver
    this.rejector = rejector
  }

  isSettled(): boolean {
    return this.status != null
  }

  resolve(value: Value | PromiseLike<Value>): void {
    this.status ??= DeferredStatus.Resolved
    this.resolver(value)
  }

  reject(reason?: any): void {
    this.status ??= DeferredStatus.Rejected
    this.rejector(reason)
  }
}

export function defer<Value>(): Deferred<Value> {
  const deferred = new Deferred<Value>()

  return deferred
}

class Person {
  constructor(
    public readonly sex: 'male' | 'female',
    public readonly name: string,
  ) {}

  greet() {
    console.log(`Good evening, ${this.sex === 'male' ? 'Mr' : 'Mrs'} ${this.name}!`)
  }
}

function createPerson(sex: 'male' | 'female', name: string) {
  const person = new Person(sex, name)

  return person
}
