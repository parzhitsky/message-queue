export interface Closable {
  close(): void | Promise<void>
  isClosed(): boolean
}
