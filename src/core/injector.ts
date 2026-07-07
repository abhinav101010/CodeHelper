const CH_MANAGED_ATTR = 'data-ch-managed';

export function injectStyle(id: string, css: string): HTMLStyleElement {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    el.setAttribute(CH_MANAGED_ATTR, 'true');
    document.head.appendChild(el);
  }
  el.textContent = css;
  return el;
}

export function removeStyle(id: string): void {
  document.getElementById(id)?.remove();
}

export function removeAllCHStyles(): void {
  document.querySelectorAll(`style[${CH_MANAGED_ATTR}]`).forEach((el) => el.remove());
}

export function injectScript(src: string): HTMLScriptElement {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(src);
  script.setAttribute(CH_MANAGED_ATTR, 'true');
  document.head.appendChild(script);
  return script;
}

export function removeInjectedScripts(): void {
  document.querySelectorAll(`script[${CH_MANAGED_ATTR}]`).forEach((el) => el.remove());
}
