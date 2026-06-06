import type { ShikoNode } from "../model/node";

export function findById<T = unknown>(
  root: ShikoNode<T>,
  id: string,
): ShikoNode<T> | null {
  const stack: ShikoNode<T>[] = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    if (node.id === id) {
      return node;
    }

    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push(node.children[i]!);
    }
  }

  return null;
}

export function findParent<T = unknown>(
  root: ShikoNode<T>,
  id: string,
): ShikoNode<T> | null {
  if (root.id === id) {
    return null;
  }

  const stack: ShikoNode<T>[] = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      const child = node.children[i]!;
      if (child.id === id) {
        return node;
      }
      stack.push(child);
    }
  }

  return null;
}

export function flatten<T = unknown>(root: ShikoNode<T>): ShikoNode<T>[] {
  const result: ShikoNode<T>[] = [];
  const stack: ShikoNode<T>[] = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    result.push(node);
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push(node.children[i]!);
    }
  }

  return result;
}
/**
 * Extracts the base array key from an edge label, e.g.
 * "content[0]" → "content", "[0]" → null, "marks[1][0]" → "marks[1]"
 */
export function getGroupBaseKey(edgeLabel: string): string | null {
  const match = edgeLabel.match(/^(.*)\[\d+\]$/);
  if (!match) return null;
  const base = match[1];
  return base && base.length > 0 ? base : null;
}


export function flattenVisible<T = unknown>(
  root: ShikoNode<T>,
  expandedIds: ReadonlySet<string>,
  hiddenIds?: ReadonlySet<string>,
  hiddenGroupKeys?: ReadonlyMap<string, ReadonlySet<string>>,
): ShikoNode<T>[] {
  const result: ShikoNode<T>[] = [];
  const stack: ShikoNode<T>[] = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    result.push(node);
    if (!expandedIds.has(node.id)) {
      continue;
    }

    const nodeHiddenGroups = hiddenGroupKeys?.get(node.id);

    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      const child = node.children[i]!;
      if (hiddenIds?.has(child.id)) continue;
      // Group hiding: skip children whose array-key group is hidden
      if (nodeHiddenGroups?.size && child.edgeLabel) {
        const groupKey = getGroupBaseKey(child.edgeLabel);
        if (groupKey && nodeHiddenGroups.has(groupKey)) continue;
      }
      stack.push(child);
    }
  }

  return result;
}

export function computeDepths<T = unknown>(
  root: ShikoNode<T>,
): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  const stack: Array<{ node: ShikoNode<T>; depth: number }> = [{
    node: root,
    depth: 0,
  }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    result.set(current.node.id, current.depth);

    for (let i = current.node.children.length - 1; i >= 0; i -= 1) {
      stack.push({ node: current.node.children[i]!, depth: current.depth + 1 });
    }
  }

  return result;
}

export function allIds<T = unknown>(root: ShikoNode<T>): ReadonlySet<string> {
  const ids = new Set<string>();
  const stack: ShikoNode<T>[] = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    ids.add(node.id);
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push(node.children[i]!);
    }
  }

  return ids;
}

export function buildNodeMap<T = unknown>(
  root: ShikoNode<T>,
): ReadonlyMap<string, ShikoNode<T>> {
  const result = new Map<string, ShikoNode<T>>();
  const stack: ShikoNode<T>[] = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    result.set(node.id, node);
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push(node.children[i]!);
    }
  }

  return result;
}
