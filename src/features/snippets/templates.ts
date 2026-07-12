/**
 * VS Code Snippet Variable Resolver
 *
 * Resolves all standard VS Code snippet variables at expansion time.
 * Unknown variables are left as-is (VS Code treats them as editable placeholders).
 *
 * Supported variables:
 *   TM_FILENAME, TM_FILENAME_BASE, TM_DIRECTORY, TM_FILEPATH
 *   CURRENT_YEAR, CURRENT_MONTH, CURRENT_DATE, CURRENT_HOUR, CURRENT_MINUTE, CURRENT_SECOND
 *   CURRENT_DAY_NAME, CURRENT_MONTH_NAME
 *   WORKSPACE_NAME, WORKSPACE_FOLDER
 *   CLIPBOARD, SELECTED_TEXT, CURSOR_INDEX, CURSOR_NUMBER
 *   TM_LINE_INDEX, TM_LINE_NUMBER
 *   BLOCK_COMMENT_START, BLOCK_COMMENT_END, LINE_COMMENT
 */

/**
 * Resolve a snippet variable by name.
 * Returns the resolved value, or null if unknown.
 */
export function resolveVariable(name: string): string | null {
  switch (name) {
    case 'TM_FILENAME':
      return getFilename();
    case 'TM_FILENAME_BASE':
      return getFilenameBase();
    case 'TM_DIRECTORY':
      return getDirectory();
    case 'TM_FILEPATH':
      return getFilePath();
    case 'CURRENT_YEAR':
      return String(new Date().getFullYear());
    case 'CURRENT_MONTH':
      return String(new Date().getMonth() + 1).padStart(2, '0');
    case 'CURRENT_MONTH_NAME':
      return MONTH_NAMES[new Date().getMonth()];
    case 'CURRENT_DATE':
      return String(new Date().getDate()).padStart(2, '0');
    case 'CURRENT_DAY_NAME':
      return DAY_NAMES[new Date().getDay()];
    case 'CURRENT_HOUR':
      return String(new Date().getHours()).padStart(2, '0');
    case 'CURRENT_MINUTE':
      return String(new Date().getMinutes()).padStart(2, '0');
    case 'CURRENT_SECOND':
      return String(new Date().getSeconds()).padStart(2, '0');
    case 'CURRENT_DAY_NAME_SHORT':
      return DAY_NAMES_SHORT[new Date().getDay()];
    case 'CURRENT_MONTH_NAME_SHORT':
      return MONTH_NAMES_SHORT[new Date().getMonth()];
    case 'CURRENT_SECONDS_UNIX':
      return String(Math.floor(Date.now() / 1000));
    case 'CURRENT_TIMEZONE_OFFSET':
      return getTimezoneOffset();
    case 'WORKSPACE_NAME':
    case 'WORKSPACE_FOLDER':
      return '';
    case 'CLIPBOARD':
      return ''; // Clipboard access requires user interaction in browser
    case 'SELECTED_TEXT':
      return getSelectedText();
    case 'CURSOR_INDEX':
      return '0'; // We only have one cursor
    case 'CURSOR_NUMBER':
      return '1';
    case 'TM_LINE_INDEX':
      return '0'; // Will be overridden at expansion time if available
    case 'TM_LINE_NUMBER':
      return '1';
    case 'BLOCK_COMMENT_START':
      return getBlockCommentStart();
    case 'BLOCK_COMMENT_END':
      return getBlockCommentEnd();
    case 'LINE_COMMENT':
      return getLineComment();
    default:
      return null; // Unknown variable → editable placeholder
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getFilename(): string {
  const path = window.location.pathname;
  const parts = path.split('/');
  return parts[parts.length - 1] || 'untitled';
}

function getFilenameBase(): string {
  const name = getFilename();
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.substring(0, dot) : name;
}

function getDirectory(): string {
  const path = window.location.pathname;
  const slash = path.lastIndexOf('/');
  return slash > 0 ? path.substring(0, slash) : '';
}

function getFilePath(): string {
  return window.location.pathname;
}

function getSelectedText(): string {
  try {
    const sel = window.getSelection();
    return sel?.toString() ?? '';
  } catch {
    return '';
  }
}

function getTimezoneOffset(): string {
  const offset = -new Date().getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getBlockCommentStart(): string {
  // Default for common languages
  return '/*';
}

function getBlockCommentEnd(): string {
  return '*/';
}

function getLineComment(): string {
  return '//';
}

// ── Date/time names ────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const DAY_NAMES_SHORT = [
  'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
];
