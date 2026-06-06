import { ShikoTreeController } from "./packages/shiko-core/src/controller/tree-controller.ts";
import { convertJsonToShiko } from "./apps/json-chizu/src/lib/json-to-shiko.ts";

const mainJson = {
  id: 101,
  status: "active",
  metadata_string: "{\"user_id\":456,\"role\":\"admin\",\"tags\":[\"api\",\"test\"]}"
};

const { root } = convertJsonToShiko(mainJson);
const tree = new ShikoTreeController({ root, initialExpandedIds: [root.id] });
const metadataNode = tree.visibleNodes().find(n => n.label && n.label.startsWith("metadata_string"));

const parsedValue = JSON.parse("{\"user_id\":456,\"role\":\"admin\",\"tags\":[\"api\",\"test\"]}");
const wrapped = { metadata_string: parsedValue };
const parsedTree = convertJsonToShiko(wrapped);
const targetNode = parsedTree.root.children[0];

function prefixNodeIds(node, prefix) {
  return {
    ...node,
    id: `${prefix}${node.id}`,
    children: node.children.map(c => prefixNodeIds(c, prefix))
  };
}
const prefixedNode = prefixNodeIds(targetNode, `__json__${metadataNode.id}__metadata_string__`);
tree.injectJsonNode(metadataNode.id, "metadata_string", prefixedNode);

// Debug estimateNodeSize
import { getRowUntruncatedValue, getWrappedLinesCount, parseRowKey } from "./packages/shiko-vue/src/utils/renderUtils.ts";

const node = metadataNode;
const font = "12px sans-serif";
const defaultNodeSize = { width: 160, height: 70 };
const expandedTextRows = tree.expandedTextRowIds;
const expandedJsonRows = tree.expandedJsonRowIds;

const label = node.label ?? node.id;
const lines = label.split("\n").filter((line) => line.trim().length > 0);
const firstLineIsItemHeader = lines.length > 1 && false; // isArrayItemHeaderLine placeholder
const bodyLines = lines;

const fontSize = 12;
const rowHeight = 18;
const avgCharWidth = 7.02;
const horizontalPadding = 14;

console.log("bodyLines count:", bodyLines.length);

const hasWrappedLines = bodyLines.some((line, i) => {
  const untruncated = getRowUntruncatedValue(node, line, i);
  return untruncated.length * avgCharWidth > defaultNodeSize.width - horizontalPadding * 2 - 60;
});
const hasJsonRows = true; // since it is JSON row
const hasButtons = true;
const rowBtnReserve = 25;

let maxLineWidth = defaultNodeSize.width;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  const separatorIndex = line.indexOf(":");
  const keyPart = line.slice(0, separatorIndex + 1);
  const keyDisplay = `${keyPart} `;
  const untruncatedVal = getRowUntruncatedValue(node, line, i);
  const kw = keyDisplay.length * avgCharWidth;
  const vw = untruncatedVal.length * avgCharWidth;
  const w = kw + vw;
  console.log(`Line ${i}: w=${w}, kw=${kw}, vw=${vw}`);
  const neededWidth = w + horizontalPadding * 2 + rowBtnReserve;
  if (neededWidth > maxLineWidth) {
    maxLineWidth = neededWidth;
  }
}

const nodeWidth = Math.max(defaultNodeSize.width, Math.min(600, Math.ceil(maxLineWidth)));
const maxTextWidth = nodeWidth - horizontalPadding * 2 - rowBtnReserve;
console.log("nodeWidth:", nodeWidth, "maxTextWidth:", maxTextWidth);

let totalBodyLines = 0;
for (let i = 0; i < bodyLines.length; i++) {
  const line = bodyLines[i]!;
  const rowKey = parseRowKey(line) || `row-${i}`;
  const rowId = `${node.id}::${rowKey}`;
  const isRowExpanded = expandedTextRows?.has(rowId) ?? false;
  
  // Wait, let's call the actual compiled renderUtils function or trace getWrappedLinesCount
  const wrappedLinesCount = getWrappedLinesCount(null, node, line, i, maxTextWidth, fontSize, avgCharWidth);
  const finalRowLines = isRowExpanded ? wrappedLinesCount : Math.min(4, wrappedLinesCount);
  console.log(`Row ${i} (${rowId}): isRowExpanded=${isRowExpanded}, wrappedLinesCount=${wrappedLinesCount}, finalRowLines=${finalRowLines}`);
  totalBodyLines += finalRowLines;
}

const estimatedHeight = 24 + totalBodyLines * rowHeight;
console.log("estimatedHeight:", estimatedHeight);
console.log("Final height:", Math.max(defaultNodeSize.height, Math.min(2000, Math.ceil(estimatedHeight) + 1)));
