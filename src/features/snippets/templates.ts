export function resolveVariable(name: string): string {
  switch (name) {
    case 'TM_FILENAME':
      return getFilename();
    case 'CLIPBOARD':
      return ''; // Clipboard access requires user interaction
    case 'CURSOR':
      return '';
    case 'SELECTED_TEXT':
      return '';
    default:
      return `$${name}`;
  }
}

function getFilename(): string {
  const path = window.location.pathname;
  const parts = path.split('/');
  return parts[parts.length - 1] || 'untitled';
}
