import React, { RefObject, useRef, useState, useEffect } from '../../../../lib/teact/teact';
import useLastCallback from '../../../../hooks/useLastCallback';
import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { Signal } from '../../../../util/signals';

export const SAFARI_BR = '<br>';

export interface HistoryItem {
  html: string;
  selectionStart: number;
  selectionEnd: number;
  isDefault?: boolean;
}

export function useMessageInputHistory({ chatId, getHtml, inputRef, cloneRef, onUpdate, resetHistoryKey }: {
  chatId: string,
  getHtml: Signal<string>,
  inputRef: RefObject<HTMLDivElement | null>, 
  cloneRef: RefObject<HTMLDivElement | null>,
  onUpdate: (html: string) => void,
  resetHistoryKey?: number;
}) {
  const [historyPosition, setHistoryPosition] = useState(-1);
  const historyRef = useRef<HistoryItem[]>([]);
  const isUndoRedoRef = useRef(false);
  const defaultHtmlRef = useRef(getHtml());
  
  
  useEffect(() => {
    return () => {
      isUndoRedoRef.current = false;
      historyRef.current = [];
      defaultHtmlRef.current = '';
      setHistoryPosition(-1);
    };
  }, [chatId, resetHistoryKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      let defaultHtml = getHtml();
      if (defaultHtml === SAFARI_BR) defaultHtml = '';
      const initialHistoryItem: HistoryItem = {
        isDefault: true,
        html: defaultHtml,
        selectionStart: 0,
        selectionEnd: 0
      };
      historyRef.current = [initialHistoryItem, initialHistoryItem];
      setHistoryPosition(1);
      defaultHtmlRef.current = defaultHtml;
    }, 100);
    return () => {
      clearTimeout(timer)
    }
  }, [chatId]);

  const saveHistory = useLastCallback((html: string) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    // Don't save if content hasn't changed
    const currentItem = historyRef.current[historyPosition];
    if (currentItem && currentItem.html === html) {
      return;
    }

    // Handle empty content cases
    const isEmptyContent = !html || html === SAFARI_BR;
    if (isEmptyContent && historyRef.current.length === 0) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || !inputRef.current) return;

    const range = selection.getRangeAt(0);
    const selectionStart = getSelectionOffset(range.startContainer, range.startOffset, inputRef.current);
    const selectionEnd = getSelectionOffset(range.endContainer, range.endOffset, inputRef.current);

    const newHistoryItem: HistoryItem = {
      html: isEmptyContent ? defaultHtmlRef.current : html,
      selectionStart,
      selectionEnd,
    };

    const newPosition = historyPosition + 1;
    historyRef.current = [
      ...historyRef.current.slice(0, newPosition),
      newHistoryItem,
    ];

    
    setHistoryPosition(newPosition);
  });

  const restoreHistory = useLastCallback((step: number) => {
    let position = historyPosition + step;

    const historyItem = historyRef.current[position];

    if (!historyItem) return;

    isUndoRedoRef.current = true;
    
    // Update content
    const contentToRestore = historyItem.html || defaultHtmlRef.current;
    onUpdate(contentToRestore);
    if (inputRef.current) inputRef.current.innerHTML = contentToRestore;
    if (cloneRef.current) cloneRef.current.innerHTML = contentToRestore;

    // Restore selection
    requestMutation(() => {
      restoreSelection(inputRef.current!, historyItem);
    });

    setHistoryPosition(historyItem.isDefault ? 0 : position);
    isUndoRedoRef.current = false;
  });

  return {
    historyPosition,
    saveHistory,
    restoreHistory,
  };
}

// Helper function to get selection offset with improved accuracy
function getSelectionOffset(container: Node, offset: number, root: Node): number {
  if (container === root) return offset;
  
  let totalOffset = offset;
  let node = container;
  
  while (node !== root && node.parentNode) {
    let sibling = node.previousSibling;
    while (sibling) {
      totalOffset += sibling.textContent?.length || 0;
      sibling = sibling.previousSibling;
    }
    node = node.parentNode;
  }
  
  return totalOffset;
}

// Helper function to restore selection with better error handling
function restoreSelection(root: HTMLElement, historyItem: HistoryItem) {
  const selection = window.getSelection();
  if (!selection) return;

  try {
    const range = document.createRange();
    const startPos = findNodeAndOffsetForPosition(root, historyItem.selectionStart);
    const endPos = findNodeAndOffsetForPosition(root, historyItem.selectionEnd);

    if (startPos && endPos) {
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } catch (err) {
    // Fallback: place cursor at end
    const range = document.createRange();
    const lastTextNode = findLastTextNode(root) || root;
    range.selectNodeContents(lastTextNode);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// Existing helper functions remain the same
export function findNodeAndOffsetForPosition(container: Node, targetOffset: number): { node: Node; offset: number } | null {
  let currentOffset = 0;
  
  function traverse(node: Node): { node: Node; offset: number } | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length || 0;
      if (currentOffset + length >= targetOffset) {
        return { 
          node,
          offset: targetOffset - currentOffset
        };
      }
      currentOffset += length;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        const result = traverse(node.childNodes[i]);
        if (result) return result;
      }
    }
    return null;
  }

  const result = traverse(container);
  if (!result) {
    const lastTextNode = findLastTextNode(container);
    return lastTextNode ? {
      node: lastTextNode,
      offset: lastTextNode.textContent?.length || 0
    } : null;
  }
  return result;
}

export function findLastTextNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node;
  }
  
  for (let i = node.childNodes.length - 1; i >= 0; i--) {
    const lastTextNode = findLastTextNode(node.childNodes[i]);
    if (lastTextNode) {
      return lastTextNode;
    }
  }
  
  return null;
}