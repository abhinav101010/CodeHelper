import type { BridgeMessage, MessageType } from '../types/messages';

const BRIDGE_NS = '__CH_BRIDGE__';
let requestId = 0;
const pendingRequests = new Map<
  string,
  {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
  }
>();

export function sendToMain(type: MessageType, payload: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = String(++requestId);
    pendingRequests.set(id, { resolve, reject });

    const message: BridgeMessage = {
      type,
      payload,
      requestId: id,
      source: 'isolated',
    };

    window.postMessage({ namespace: BRIDGE_NS, ...message }, '*');

    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Bridge timeout for ${type}`));
      }
    }, 5000);
  });
}

export function sendToIsolated(type: MessageType, payload: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = String(++requestId);
    pendingRequests.set(id, { resolve, reject });

    const message: BridgeMessage = {
      type,
      payload,
      requestId: id,
      source: 'main',
    };

    window.postMessage({ namespace: BRIDGE_NS, ...message }, '*');

    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Bridge timeout for ${type}`));
      }
    }, 5000);
  });
}

export function onMessage(
  callback: (type: MessageType, payload: unknown, respond?: (v: unknown) => void) => void,
): void {
  window.addEventListener('message', (event) => {
    if (event.data?.namespace !== BRIDGE_NS) return;
    if (event.source !== window) return;

    const { type, payload, requestId } = event.data as BridgeMessage;

    callback(type, payload, (response) => {
      const responseMessage: BridgeMessage = {
        type: 'RESPONSE',
        payload: response,
        requestId,
        source: event.data.source === 'isolated' ? 'main' : 'isolated',
      };

      window.postMessage({ namespace: BRIDGE_NS, ...responseMessage }, '*');
    });
  });
}

export function handleResponse(event: MessageEvent): void {
  if (event.data?.namespace !== BRIDGE_NS) return;
  if (event.data?.type !== 'RESPONSE') return;
  if (!event.data?.requestId) return;

  const pending = pendingRequests.get(event.data.requestId);
  if (pending) {
    pendingRequests.delete(event.data.requestId);
    pending.resolve(event.data.payload);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', handleResponse);
}
