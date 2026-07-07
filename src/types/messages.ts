export type MessageType =
  | 'SETTINGS_UPDATE'
  | 'SETTINGS_REQUEST'
  | 'COMMAND'
  | 'RESPONSE'
  | 'EDITOR_READY'
  | 'SETTINGS_CHANGED'
  | 'THEME_CHANGED'
  | 'FEATURE_TOGGLED';

export interface BridgeMessage {
  type: MessageType;
  payload: unknown;
  requestId?: string;
  source: 'isolated' | 'main';
}
