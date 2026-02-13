import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  postProcessFileFrontmatterAliases,
  updateMarkdownFrontmatterAliases,
} from "../src/frontmatterAliases.js";

test("updateMarkdownFrontmatterAliases: inline array aliases", () => {
  const input = `---
title: Test
aliases: ['/tidb/stable/vector-search-get-started-using-python/','/tidb/dev/vector-search-get-started-using-python/','/tidbcloud/vector-search-get-started-using-python/']
---

body
`;

  const expected = `---
title: Test
aliases: ['/zh/tidb/stable/vector-search-get-started-using-python/','/zh/tidb/dev/vector-search-get-started-using-python/','/zh/tidbcloud/vector-search-get-started-using-python/']
---

body
`;

  assert.equal(updateMarkdownFrontmatterAliases(input, "zh"), expected);
});

test("updateMarkdownFrontmatterAliases: list aliases preserves quotes/comments", () => {
  const input = `---
aliases:
  - /tidb/stable/a/
  - '/tidb/dev/b/' # keep
  - "/zh/already/"
title: T
---
`;

  const expected = `---
aliases:
  - /zh/tidb/stable/a/
  - '/zh/tidb/dev/b/' # keep
  - "/zh/already/"
title: T
---
`;

  assert.equal(updateMarkdownFrontmatterAliases(input, "zh"), expected);
});

test("updateMarkdownFrontmatterAliases: does not prefix absolute URLs", () => {
  const input = `---
aliases: ['https://example.com/a/','mailto:test@example.com']
---
`;

  assert.equal(updateMarkdownFrontmatterAliases(input, "zh"), input);
});

test("updateMarkdownFrontmatterAliases: keeps CRLF newlines", () => {
  const input = `---\r\naliases: ['/tidb/stable/a/']\r\n---\r\n`;
  const expected = `---\r\naliases: ['/zh/tidb/stable/a/']\r\n---\r\n`;

  assert.equal(updateMarkdownFrontmatterAliases(input, "zh"), expected);
});

test("updateMarkdownFrontmatterAliases: no frontmatter returns original", () => {
  const input = "# Title\n\nContent\n";
  assert.equal(updateMarkdownFrontmatterAliases(input, "zh"), input);
});

test("postProcessFileFrontmatterAliases: updates file in-place", () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "frontmatter-aliases-")
  );
  try {
    const filePath = path.join(tempDir, "doc.md");
    fs.writeFileSync(
      filePath,
      `---\naliases: ['/tidb/stable/a/']\n---\n\nbody\n`
    );

    postProcessFileFrontmatterAliases(filePath, "zh");

    const updated = fs.readFileSync(filePath, "utf8");
    assert.equal(
      updated,
      `---\naliases: ['/zh/tidb/stable/a/']\n---\n\nbody\n`
    );

    assert.doesNotThrow(() =>
      postProcessFileFrontmatterAliases(
        path.join(tempDir, "missing.md"),
        "zh"
      )
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

