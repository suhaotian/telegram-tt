export function getAllNodesAndText(element: HTMLElement | ChildNode) {
  const result: {
    node: HTMLElement | ChildNode;
    startPos: number;
    text: string | null;
    length: number;
  }[] = [];
  let currentTextContent = '';
  
  function traverse(node: HTMLElement | ChildNode) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      result.push({
          node: node,
          startPos: currentTextContent.length,
          text: text,
          length: text!.length
      });
      currentTextContent += text;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (let child of node.childNodes) {
          traverse(child);
      }
    }
  }

  traverse(element);
  return { nodes: result, fullText: currentTextContent };
}