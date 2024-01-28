export type MessageType = string // encapsulation

export { MessageType as Type } // alias

export type MessageTypeToDataMapAny = Record<MessageType, unknown>

export type MessageTypeOf<Map extends MessageTypeToDataMapAny> = Extract<keyof Map, MessageType>

export interface Message<out Type extends MessageType, Data> {
  readonly type: Type
  readonly data: Data
}
