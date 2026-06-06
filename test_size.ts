import { createNode } from "./packages/shiko-core/src/model/node.ts";
import { estimateNodeSize } from "./packages/shiko-vue/src/utils/renderUtils.ts";

const node = createNode({
  id: "n-3",
  label: "metadata_string: {\"user_id\":456,\"role\":\"admin\",\"tags\":[\"api\",\"test\"]}",
  data: {
    path: "$.metadata_string",
    value: "{\"user_id\":456,\"role\":\"admin\",\"tags\":[\"api\",\"test\"]}"
  },
  children: []
});

const font = "12px sans-serif";
const defaultNodeSize = { width: 160, height: 56 };

// Collapsed size
const collapsed = estimateNodeSize(node, font, defaultNodeSize);
console.log("Collapsed:");
console.log("  width:", collapsed.width);
console.log("  height:", collapsed.height);

// Expanded size
const expandedJsonRowIds = new Set(["n-3::metadata_string"]);
const expanded = estimateNodeSize(node, font, defaultNodeSize, undefined, expandedJsonRowIds);
console.log("Expanded JSON Row:");
console.log("  width:", expanded.width);
console.log("  height:", expanded.height);
