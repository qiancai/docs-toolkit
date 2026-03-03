import test from "node:test";
import assert from "node:assert/strict";

import { createGitHubIdProtector } from "../src/githubIdProtector.js";

test("createGitHubIdProtector: keeps GitHub handle unchanged", () => {
  const input = "Thanks @pingcap-dev for helping on this issue.";
  const { text, restore } = createGitHubIdProtector(input);
  const translated = text.replace("for helping on this issue.", "のサポートに感謝します。");

  assert.equal(restore(translated), "Thanks @pingcap-dev のサポートに感謝します。");
});

test("createGitHubIdProtector: keeps owner/repo unchanged", () => {
  const input = "Refer to pingcap/docs-toolkit before release.";
  const { text, restore } = createGitHubIdProtector(input);
  const translated = text.replace("before release.", "リリース前に確認してください。");

  assert.equal(
    restore(translated),
    "Refer to pingcap/docs-toolkit リリース前に確認してください。"
  );
});

test("createGitHubIdProtector: supports no-translate span markers", () => {
  const input = "Contributors: @alice and pingcap/tidb.";
  const { text, restore } = createGitHubIdProtector(input, {
    useNoTranslateSpan: true,
  });

  const translated =
    text.replace("Contributors:", "貢献者:") + " ありがとうございます。";

  assert.equal(
    restore(translated),
    "貢献者: @alice and pingcap/tidb. ありがとうございます。"
  );
});
