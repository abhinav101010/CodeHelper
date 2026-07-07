import type { ParsedSnippet, Segment } from '../../types/snippet';

export function parseSnippet(body: string): ParsedSnippet {
  const segments: Segment[] = [];
  let i = 0;

  while (i < body.length) {
    // Handle escaped characters
    if (body[i] === '\\' && i + 1 < body.length) {
      segments.push({ type: 'text', value: body[i + 1] });
      i += 2;
      continue;
    }

    // Handle tabstops: $1, $2, etc.
    if (body[i] === '$' && i + 1 < body.length && /[0-9]/.test(body[i + 1])) {
      const index = parseInt(body[i + 1], 10);
      segments.push({ type: 'tabstop', index });
      i += 2;
      continue;
    }

    // Handle ${1:placeholder} or ${1}
    if (body[i] === '$' && body[i + 1] === '{') {
      const closingBrace = body.indexOf('}', i + 2);
      if (closingBrace !== -1) {
        const content = body.substring(i + 2, closingBrace);
        const colonIndex = content.indexOf(':');

        if (colonIndex !== -1) {
          const index = parseInt(content.substring(0, colonIndex), 10);
          const placeholder = content.substring(colonIndex + 1);
          segments.push({
            type: 'tabstop',
            index,
            children: [{ type: 'text', value: placeholder }],
          });
        } else {
          const index = parseInt(content, 10);
          segments.push({ type: 'tabstop', index });
        }

        i = closingBrace + 1;
        continue;
      }
    }

    // Handle variables: $TM_FILENAME, $CLIPBOARD, etc.
    if (body[i] === '$' && /[A-Z]/.test(body[i + 1] ?? '')) {
      let varName = '';
      let j = i + 1;
      while (j < body.length && /[A-Z_]/.test(body[j])) {
        varName += body[j];
        j++;
      }
      segments.push({ type: 'variable', value: varName });
      i = j;
      continue;
    }

    // Regular text
    segments.push({ type: 'text', value: body[i] });
    i++;
  }

  return { segments };
}
