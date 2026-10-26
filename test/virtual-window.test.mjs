import test from "node:test";
import assert from "node:assert/strict";
import { calculateVirtualSlice } from "../src/hooks/use-virtual-window.ts";

test("VirtualWindow: returns zero slice for empty list", () => {
  const slice = calculateVirtualSlice(0, 100, 0, 800, 3);
  assert.equal(slice.startIndex, 0);
  assert.equal(slice.endIndex, 0);
  assert.equal(slice.totalHeight, 0);
  assert.equal(slice.topPadding, 0);
  assert.equal(slice.bottomPadding, 0);
});

test("VirtualWindow: computes initial slice with overscan at top of scroll", () => {
  // 100 items, 100px each = 10,000px total height. Viewport is 800px (8 visible items).
  const slice = calculateVirtualSlice(100, 100, 0, 800, 2);

  // At top: rawStart is 0, rawEnd is 8. Overscan = 2.
  // startIndex = max(0, 0 - 2) = 0
  // endIndex = min(100, 8 + 2) = 10
  assert.equal(slice.startIndex, 0);
  assert.equal(slice.endIndex, 10);
  assert.equal(slice.topPadding, 0);
  assert.equal(slice.bottomPadding, (100 - 10) * 100); // 9000px
  assert.equal(slice.totalHeight, 10000);
});

test("VirtualWindow: computes middle scroll slice and symmetrical spacer paddings", () => {
  // Scroll offset 2,000px (item index 20).
  // rawStart = 20, rawEnd = 28. Overscan = 3.
  // startIndex = 20 - 3 = 17.
  // endIndex = 28 + 3 = 31.
  const slice = calculateVirtualSlice(100, 100, 2000, 800, 3);

  assert.equal(slice.startIndex, 17);
  assert.equal(slice.endIndex, 31);
  assert.equal(slice.topPadding, 17 * 100); // 1,700px
  assert.equal(slice.bottomPadding, (100 - 31) * 100); // 6,900px
  assert.equal(
    slice.topPadding + (slice.endIndex - slice.startIndex) * 100 + slice.bottomPadding,
    10000,
    "Virtual DOM slice + spacers must exactly match total height"
  );
});

test("VirtualWindow: clamps to bottom bounds without exceeding itemCount", () => {
  // Scrolled to bottom: 9,500px
  const slice = calculateVirtualSlice(100, 100, 9500, 800, 3);

  assert.equal(slice.endIndex, 100, "endIndex should not exceed itemCount");
  assert.equal(slice.bottomPadding, 0, "bottomPadding should be 0 when at bottom of list");
});
