export function waitForEditor(
  detector: () => HTMLElement | null,
  options: { timeout?: number; interval?: number } = {},
): Promise<HTMLElement> {
  const { timeout = 15000, interval = 500 } = options;

  return new Promise((resolve, reject) => {
    // Check immediately
    const el = detector();
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const el = detector();
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Editor not found within ${timeout}ms`));
    }, timeout);
  });
}
