export type MessageType = string // encapsulation

export { MessageType as Type } // alias

export type MessageTypeToDataMapUnknown = Record<MessageType, unknown>

export type MessageTypeOf<Map extends MessageTypeToDataMapUnknown> = Extract<keyof Map, MessageType>

export interface Message<out Type extends MessageType, Data> {
  readonly type: Type
  readonly data: Data
}
