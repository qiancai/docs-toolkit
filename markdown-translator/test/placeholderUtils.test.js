import test from "node:test";
import assert from "node:assert/strict";

import {
  createLinkPlaceholderHtml,
  restorePreservedPlaceholders,
} from "../src/placeholderUtils.js";

test("createLinkPlaceholderHtml wraps translated link text in a restorable anchor", () => {
  assert.equal(
    createLinkPlaceholderHtml(3, "https://docs.pingcap.com/tidb/stable/overview", "TiDB"),
    '<a href="https://docs.pingcap.com/tidb/stable/overview" translate="no" data-docs-link-placeholder="3">TiDB</a>'
  );
});

test("restorePreservedPlaceholders restores link anchors back to placeholder markers", () => {
  const input =
    '<a href="https://www.pingcap.com/tidb-cloud/" translate="no" data-docs-link-placeholder="0">TiDB Cloud</a>は、<a data-docs-link-placeholder="1" translate="no" href="https://docs.pingcap.com/tidb/stable/overview">TiDB</a>をベースにしています。';

  assert.equal(
    restorePreservedPlaceholders(input),
    "{{B-PLACEHOLDER-0-PLACEHOLDER-E}}は、{{B-PLACEHOLDER-1-PLACEHOLDER-E}}をベースにしています。"
  );
});

test("restorePreservedPlaceholders keeps generic no-translate markers for non-link placeholders", () => {
  const input =
    '<span translate="no">2</span>body<span translate="no">3</span>';

  assert.equal(
    restorePreservedPlaceholders(input),
    "{{B-PLACEHOLDER-2-PLACEHOLDER-E}}body{{B-PLACEHOLDER-3-PLACEHOLDER-E}}"
  );
});
