import type { ShikoNode } from "../model/node";
import {
  allIds,
  computeDepths,
  findParent,
  flattenVisible,
} from "../util/tree-utils";
import { ListenableStore } from "./listenable";

export interface TreeControllerOptions<T = unknown> {
  root?: ShikoNode<T>;
  initialExpandedIds?: Iterable<string>;
}

export class ShikoTreeController<T = unknown> extends ListenableStore {
  private _root: ShikoNode<T> | null;
  private readonly expanded = new Set<string>();
  private readonly hidden = new Set<string>();
  private readonly hiddenGroups = new Map<string, Set<string>>();
  private readonly expandedTextRows = new Set<string>();
  private readonly expandedJsonRows = new Set<string>();
  /**
   * Dynamically injected child nodes from parsed JSON strings.
   * Key: `${parentNodeId}::${rowKey}`, Value: the synthetic ShikoNode.
   * The parent is expected to have the injected node listed in its children
   * only virtually — the layout picks it up via visibleNodes().
   */
  private readonly injectedNodes = new Map<string, ShikoNode<T>>();

  private _treeRevision = 0;
  private _expansionRevision = 0;

  constructor(options: TreeControllerOptions<T> = {}) {
    super();
    this._root = options.root ?? null;

    if (options.initialExpandedIds) {
      for (const id of options.initialExpandedIds) {
        this.expanded.add(id);
      }
    }
  }

  get root(): ShikoNode<T> | null {
    return this._root;
  }

  get treeRevision(): number {
    return this._treeRevision;
  }

  get expansionRevision(): number {
    return this._expansionRevision;
  }

  get expandedIds(): ReadonlySet<string> {
    return this.expanded;
  }

  get hiddenIds(): ReadonlySet<string> {
    return this.hidden;
  }

  get hiddenGroupKeys(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.hiddenGroups;
  }

  get expandedTextRowIds(): ReadonlySet<string> {
    return this.expandedTextRows;
  }

  get expandedJsonRowIds(): ReadonlySet<string> {
    return this.expandedJsonRows;
  }

  /** All currently injected synthetic nodes, keyed by `parentId::rowKey`. */
  get injectedNodeMap(): ReadonlyMap<string, ShikoNode<T>> {
    return this.injectedNodes;
  }

  setRoot(root: ShikoNode<T>): void {
    this._root = root;
    this.hidden.clear();
    this.hiddenGroups.clear();
    this.expandedTextRows.clear();
    this.expandedJsonRows.clear();
    this.injectedNodes.clear();
    this._treeRevision += 1;
    this.emit();
  }

  toggleTextRowExpansion(nodeId: string, rowKey: string): void {
    const rowId = `${nodeId}::${rowKey}`;
    if (this.expandedTextRows.has(rowId)) {
      this.expandedTextRows.delete(rowId);
    } else {
      this.expandedTextRows.add(rowId);
    }
    this._expansionRevision += 1;
    this.emit();
  }

  isTextRowExpanded(nodeId: string, rowKey: string): boolean {
    return this.expandedTextRows.has(`${nodeId}::${rowKey}`);
  }

  /**
   * Injects a parsed JSON node as a synthetic child of `parentNodeId`.
   * The injected node is also auto-expanded and the parent is auto-expanded.
   * Calling again with the same key replaces the previous node.
   */
  injectJsonNode(parentNodeId: string, rowKey: string, node: ShikoNode<T>): void {
    const key = `${parentNodeId}::${rowKey}`;
    this.injectedNodes.set(key, node);
    this.expandedJsonRows.add(key);
    // Auto-expand the parent so the injected child is visible
    this.expanded.add(parentNodeId);
    // Also auto-expand the injected node itself so its children are traversable and visible
    this.expanded.add(node.id);
    this._expansionRevision += 1;
    this.emit();
  }

  /**
   * Removes the injected node for `parentNodeId::rowKey` and collapses it.
   */
  removeInjectedJsonNode(parentNodeId: string, rowKey: string): void {
    const key = `${parentNodeId}::${rowKey}`;
    const node = this.injectedNodes.get(key);
    if (!node) return;
    this.injectedNodes.delete(key);
    this.expandedJsonRows.delete(key);
    this.expanded.delete(node.id);
    this._expansionRevision += 1;
    this.emit();
  }

  /**
   * Toggles the injected JSON node. When collapsing, removes the injected node.
   * When expanding, callers must call `injectJsonNode` instead (since they need to
   * supply the parsed node). This method only handles collapse.
   */
  toggleJsonRowExpansion(nodeId: string, rowKey: string): void {
    const rowId = `${nodeId}::${rowKey}`;
    if (this.expandedJsonRows.has(rowId)) {
      this.removeInjectedJsonNode(nodeId, rowKey);
    }
    // Expansion is handled by injectJsonNode called from the click handler
  }

  isJsonRowExpanded(nodeId: string, rowKey: string): boolean {
    return this.expandedJsonRows.has(`${nodeId}::${rowKey}`);
  }

  isExpanded(nodeId: string): boolean {
    return this.expanded.has(nodeId);
  }

  setExpandedIds(ids: Iterable<string>): void {
    this.expanded.clear();
    for (const id of ids) {
      this.expanded.add(id);
    }
    this._expansionRevision += 1;
    this.emit();
  }

  expand(nodeId: string): void {
    if (this.expanded.has(nodeId)) {
      return;
    }
    this.expanded.add(nodeId);
    this._expansionRevision += 1;
    this.emit();
  }

  collapse(nodeId: string): void {
    if (!this.expanded.delete(nodeId)) {
      return;
    }
    this._expansionRevision += 1;
    this.emit();
  }

  toggleExpansion(nodeId: string): void {
    if (this.expanded.has(nodeId)) {
      this.expanded.delete(nodeId);
    } else {
      this.expanded.add(nodeId);
    }
    this._expansionRevision += 1;
    this.emit();
  }

  /**
   * Toggle whether a specific child node is hidden from the canvas.
   * Hidden nodes and all their descendants are removed from the layout.
   */
  toggleHidden(nodeId: string): void {
    if (this.hidden.has(nodeId)) {
      this.hidden.delete(nodeId);
    } else {
      this.hidden.add(nodeId);
    }
    this._expansionRevision += 1;
    this.emit();
  }

  hideNode(nodeId: string): void {
    if (this.hidden.has(nodeId)) return;
    this.hidden.add(nodeId);
    this._expansionRevision += 1;
    this.emit();
  }

  showNode(nodeId: string): void {
    if (!this.hidden.delete(nodeId)) return;
    this._expansionRevision += 1;
    this.emit();
  }

  isHidden(nodeId: string): boolean {
    return this.hidden.has(nodeId);
  }

  /**
   * Toggle visibility of all array items with the given base key under a parent node.
   * Used when arrays are spread directly as children (no intermediate array node).
   * E.g. toggleHiddenGroup(parentId, "content") hides/shows content[0], content[1], etc.
   */
  toggleHiddenGroup(parentId: string, groupKey: string): void {
    let groups = this.hiddenGroups.get(parentId);
    if (!groups) {
      groups = new Set();
      this.hiddenGroups.set(parentId, groups);
    }
    if (groups.has(groupKey)) {
      groups.delete(groupKey);
      if (groups.size === 0) this.hiddenGroups.delete(parentId);
    } else {
      groups.add(groupKey);
    }
    this._expansionRevision += 1;
    this.emit();
  }

  isGroupHidden(parentId: string, groupKey: string): boolean {
    return this.hiddenGroups.get(parentId)?.has(groupKey) ?? false;
  }

  expandAll(): void {
    if (!this._root) {
      return;
    }
    const ids = allIds(this._root);
    const previousSize = this.expanded.size;
    for (const id of ids) {
      this.expanded.add(id);
    }

    if (this.expanded.size === previousSize) {
      return;
    }

    this._expansionRevision += 1;
    this.emit();
  }

  collapseAll(): void {
    if (this.expanded.size === 0) {
      return;
    }

    this.expanded.clear();
    this._expansionRevision += 1;
    this.emit();
  }

  expandToLevel(level: number): void {
    if (!this._root) {
      return;
    }

    this.expanded.clear();
    const depths = computeDepths(this._root);

    for (const [id, depth] of depths) {
      if (depth < level) {
        this.expanded.add(id);
      }
    }

    this._expansionRevision += 1;
    this.emit();
  }

  /**
   * Returns the list of visible nodes, including any injected synthetic nodes.
   * Injected nodes appear as direct children of their parent in the layout.
   */
  visibleNodes(): ShikoNode<T>[] {
    if (!this._root) {
      return [];
    }

    // Build a virtual tree that includes injected nodes as children of their parents
    const injected = this.injectedNodes;
    if (injected.size === 0) {
      return flattenVisible(this._root, this.expanded, this.hidden, this.hiddenGroups);
    }

    // Build a parent-id → injected node array map
    const injectedByParent = new Map<string, ShikoNode<T>[]>();
    for (const [key, node] of injected) {
      const sep = key.indexOf("::");
      if (sep < 0) continue;
      const parentId = key.slice(0, sep);
      let list = injectedByParent.get(parentId);
      if (!list) {
        list = [];
        injectedByParent.set(parentId, list);
      }
      list.push(node);
    }

    // Flatten visible nodes and splice in injected nodes after each parent
    const base = flattenVisible(this._root, this.expanded, this.hidden, this.hiddenGroups);
    const result: ShikoNode<T>[] = [];
    for (const node of base) {
      result.push(node);
      const extraChildren = injectedByParent.get(node.id);
      if (extraChildren && this.expanded.has(node.id)) {
        for (const child of extraChildren) {
          // Also recursively flatten the injected node's own visible descendants
          const childVisible = flattenVisible(child, this.expanded, this.hidden, this.hiddenGroups);
          result.push(...childVisible);
        }
      }
    }
    return result;
  }

  getParentId(nodeId: string): string | null {
    if (!this._root) {
      return null;
    }

    // Check injected nodes first
    for (const [key, node] of this.injectedNodes) {
      if (node.id === nodeId) {
        const sep = key.indexOf("::");
        if (sep >= 0) return key.slice(0, sep);
      }
      // Check descendants of injected nodes
      const found = findInInjected(node, nodeId);
      if (found) return found;
    }

    const parent = findParent(this._root, nodeId);
    return parent?.id ?? null;
  }
}

function findInInjected<T>(node: ShikoNode<T>, targetId: string): string | null {
  for (const child of node.children) {
    if (child.id === targetId) return node.id;
    const deeper = findInInjected(child, targetId);
    if (deeper) return deeper;
  }
  return null;
}
