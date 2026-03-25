import test from "node:test";
import assert from "node:assert/strict";

import { stripDuplicateLinkTextAroundPlaceholders } from "../src/placeholderUtils.js";

test("stripDuplicateLinkTextAroundPlaceholders removes duplicated link text before a placeholder", () => {
  const input =
    "TiDB Cloud {{B-PLACEHOLDER-0-PLACEHOLDER-E}} is based on TiDB {{B-PLACEHOLDER-1-PLACEHOLDER-E}}.";
  const meta = {
    0: {
      kind: "link",
      text: "TiDB Cloud",
    },
    1: {
      kind: "link",
      text: "TiDB",
    },
  };

  assert.equal(
    stripDuplicateLinkTextAroundPlaceholders(input, meta),
    "{{B-PLACEHOLDER-0-PLACEHOLDER-E}} is based on {{B-PLACEHOLDER-1-PLACEHOLDER-E}}."
  );
});

test("stripDuplicateLinkTextAroundPlaceholders removes duplicated link text after a placeholder", () => {
  const input =
    "{{B-PLACEHOLDER-0-PLACEHOLDER-E}}TiDB Cloud clusters are supported.";
  const meta = {
    0: {
      kind: "link",
      text: "TiDB Cloud",
    },
  };

  assert.equal(
    stripDuplicateLinkTextAroundPlaceholders(input, meta),
    "{{B-PLACEHOLDER-0-PLACEHOLDER-E}} clusters are supported."
  );
});

test("stripDuplicateLinkTextAroundPlaceholders leaves non-link placeholders unchanged", () => {
  const input = "<CustomContent>{{B-PLACEHOLDER-3-PLACEHOLDER-E}}</CustomContent>";
  const meta = {
    3: {
      kind: "node",
      node: { type: "html", value: "<CustomContent>" },
    },
  };

  assert.equal(stripDuplicateLinkTextAroundPlaceholders(input, meta), input);
});
