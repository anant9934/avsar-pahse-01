/**
 * Robust JSON block parser capable of handling multiple concatenated JSON blocks
 * (such as root-level array followed by metadata object in jobs.json)
 */
export function parseMultiJsonBlocks(text: string): unknown[] {
  const blocks: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0 && start !== -1) {
        const snippet = text.slice(start, i + 1).trim();
        try {
          blocks.push(JSON.parse(snippet));
        } catch (err) {
          console.error("Failed to parse JSON block at position", start, err);
        }
        start = -1;
      }
    }
  }

  return blocks;
}
