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

/**
 * Send a message and wait for response with retries.
 * Handles the case where the other world isn't ready yet.
 */
async function sendWithRetry(
  type: MessageType,
  payload: unknown,
  source: 'main' | 'isolated',
  maxRetries = 3,
  baseDelay = 300,
): Promise<unknown> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await sendOnce(type, payload, source);
    } catch (err) {
      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt) throw err;

      // Exponential backoff: 300ms, 600ms, 1200ms
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(
        `[CodeHelper] Bridge ${type} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
        err,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Should never reach here
  throw new Error(`Bridge ${type} failed after ${maxRetries + 1} attempts`);
}

function sendOnce(
  type: MessageType,
  payload: unknown,
  source: 'main' | 'isolated',
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = String(++requestId);
    pendingRequests.set(id, { resolve, reject });

    const message: BridgeMessage = {
      type,
      payload,
      requestId: id,
      source,
    };

    window.postMessage({ namespace: BRIDGE_NS, ...message }, '*');

    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Bridge timeout for ${type}`));
      }
    }, 2000);
  });
}

export function sendToMain(type: MessageType, payload: unknown): Promise<unknown> {
  return sendWithRetry(type, payload, 'isolated');
}

export function sendToIsolated(type: MessageType, payload: unknown): Promise<unknown> {
  return sendWithRetry(type, payload, 'main');
}

export function onMessage(
  callback: (type: MessageType, payload: unknown, respond?: (v: unknown) => void) => void,
): void {
  window.addEventListener('message', (event) => {
    if (event.data?.namespace !== BRIDGE_NS) return;

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
