import { ApiMessageEntityTypes } from '../api/types';

/**
 * Parse markdown string to HTML with proper error handling
 */
export function parseMarkdownWithAST(input: string): string {
  const { nodes } = parseUntil(input, null, 0);
  const result = astToHTML(nodes);
  return result;
}

// Enhanced type definitions
type MarkerType = 'text' | 'bold' | 'italic' | 'strikethrough' | 'spoiler' | 'pre' | 'code';

interface BaseNode {
  type: MarkerType;
}

interface TextNode extends BaseNode {
  type: 'text' | 'code' | 'pre';
  content: string;
  language?: string;
}

interface ContainerNode extends BaseNode {
  type: Exclude<MarkerType, 'text' | 'code' | 'pre'>;
  children: ASTNode[];
}

export type ASTNode = TextNode | ContainerNode;

// Configuration objects
const MARKERS = {
  PRE: { token: "```", type: "pre" as const },
  CODE: { token: "`", type: "code" as const },
  BOLD: { token: "**", type: "bold" as const },
  // ITALIC: { token: "*", type: "italic" as const },
  ITALIC: { token: "__", type: "italic" as const },
  STRIKETHROUGH: { token: "~~", type: "strikethrough" as const },
  SPOILER: { token: "||", type: "spoiler" as const },
} as const;
const MARKERS_VALUES = Object.values(MARKERS);
const NESTED_MARKERS_VALUES = MARKERS_VALUES.slice(2,); // omit PRE and CODE

const hasNewline = (str: string) => /\r?\n/.test(str);
const isEmpty = (str: string) => /^\s*$/.test(str);

// Helper functions
function isTextNode(node: ASTNode): node is TextNode {
  return ['text', 'code', 'pre'].find(i => i === node.type) !== undefined;
}

function findClosingMarker(input: string, marker: string, startIndex: number): number {
  return input.indexOf(marker, startIndex + marker.length);
}

function parsePreformattedBlock(
  input: string,
  startIndex: number,
  closingPos: number
): { node: TextNode; newIndex: number } {
  const nextLineIndex = input.indexOf("\n", startIndex + MARKERS.PRE.token.length);
  let language = "";
  let contentStart = startIndex + MARKERS.PRE.token.length;
  if (nextLineIndex !== -1 && nextLineIndex < closingPos) {
    const possibleLang = input.substring(contentStart, nextLineIndex).trim();
    if (possibleLang.match(/^\w+$/)) {
      language = possibleLang;
      contentStart = nextLineIndex + 1;
    }
  }
  return {
    node: {
      type: "pre",
      content: input.substring(contentStart, closingPos),
      language
    },
    newIndex: closingPos + MARKERS.PRE.token.length
  };
}

/**
 * Recursively parse the markdown input until the given endMarker (if any)
 * is encountered. Returns an object with the list of AST nodes and the new index.
 */
export function parseUntil(
  input: string,
  endMarker: string | null,
  startIndex = 0,
  markerValues = MARKERS_VALUES,
): { nodes: ASTNode[]; index: number } {
  const nodes: ASTNode[] = [];
  let currentText = "";
  let i = startIndex;

  const flushText = () => {
    if (currentText) {
      nodes.push({ type: "text", content: currentText });
      currentText = "";
    }
  };

  while (i < input.length) {
    // Check for end marker
    if (endMarker && input.startsWith(endMarker, i)) {
      flushText();
      return { nodes, index: i + endMarker.length };
    }

    // Check for markers
    const marker = markerValues.find(m => input.startsWith(m.token, i));
    if (marker) {
      const closingPos = findClosingMarker(input, marker.token, i);
      let noEndMarker = closingPos === -1;

      if (!noEndMarker) {
        const content = input.substring(i+marker.token.length, closingPos);
        noEndMarker = isEmpty(content) || (marker.type !== 'pre' && hasNewline(content));
      }

      if (noEndMarker) {
        currentText += marker.token;
        i += marker.token.length;
        continue;
      }

      flushText();

      if (marker.type === "pre") {
        const { node, newIndex } = parsePreformattedBlock(input, i, closingPos);
        nodes.push(node);
        i = newIndex;
      } else if (marker.type === "code") {
        nodes.push({
          type: "code",
          content: input.substring(i + marker.token.length, closingPos)
        });
        i = closingPos + marker.token.length;
      } else {
        const { nodes: childNodes, index: newIndex } = parseUntil(
          input,
          marker.token,
          i + marker.token.length,
          marker.type === 'spoiler' ? NESTED_MARKERS_VALUES : []
        );
        nodes.push({ type: marker.type, children: childNodes });
        i = newIndex;
      }
      continue;
    }

    currentText += input[i];
    i++;
  }

  flushText();
  return { nodes, index: i };
}

/**
 * Convert the AST to HTML
 */
function astToHTML(nodes: ASTNode[]): string {
  return nodes
    .map(node => {
      if (isTextNode(node)) {
        switch (node.type) {
          case "text":
            return node.content;
          case "code":
            return `<code>${node.content}</code>`;
          case "pre":
            const content = node.content.trim();
            return node.language
              ? `<pre data-language="${node.language}">${content}</pre>`
              : `<pre>${content}</pre>`;
        }
      }

      const content = node.children ? astToHTML(node.children) : "";
      switch (node.type) {
        case "bold":
          return `<b>${content}</b>`;
        case "italic":
          return `<i>${content}</i>`;
        case "strikethrough":
          return `<s>${content}</s>`;
        case "spoiler":
          return `<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">${content}</span>`;
        default:
          return ``
      }
    })
    .join("");
}
