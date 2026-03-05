import * as fs from "fs";

const GITHUB_MENTION_LINK_REGEX =
  /@\s*\[[^\]]*\]\(https?:\/\/github\.com\/([^)\s\/]+)\/?\)/g;

export const fixMarkdownGithubMentions = (markdown) =>
  markdown.replaceAll(GITHUB_MENTION_LINK_REGEX, "@ [$1](https://github.com/$1)");

export const postProcessFileGithubMentions = (filePath) => {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  const updatedContent = fixMarkdownGithubMentions(content);

  if (updatedContent !== content) {
    fs.writeFileSync(filePath, updatedContent);
  }
};
