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

  setRoot(root: ShikoNode<T>): void {
    this._root = root;
    this.hidden.clear();
    this.hiddenGroups.clear();
    this.expandedTextRows.clear();
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

  visibleNodes(): ShikoNode<T>[] {
    if (!this._root) {
      return [];
    }

    return flattenVisible(this._root, this.expanded, this.hidden, this.hiddenGroups);
  }

  getParentId(nodeId: string): string | null {
    if (!this._root) {
      return null;
    }

    const parent = findParent(this._root, nodeId);
    return parent?.id ?? null;
  }
}
