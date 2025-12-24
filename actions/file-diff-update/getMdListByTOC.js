import * as fs from "fs";

import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatter } from "micromark-extension-frontmatter";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfm } from "micromark-extension-gfm";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { visit } from "unist-util-visit";

const extractLinkNodeFromAst = (mdAst) => {
  const linkList = [];
  visit(mdAst, (node) => {
    if (node.type === "link") {
      linkList.push(node.url);
    }
  });
  return linkList;
};

const filterLink = (srcList = []) => {
  const result = srcList.filter((item) => {
    const url = item.trim();
    if (url.endsWith(".md") || url.endsWith(".mdx")) return true;
    return false;
  });
  return result;
};

export const generateMdAstFromFile = (fileContent) => {
  const mdAst = fromMarkdown(fileContent, {
    extensions: [frontmatter(["yaml", "toml"]), gfm()],
    mdastExtensions: [
      mdxFromMarkdown(),
      frontmatterFromMarkdown(["yaml", "toml"]),
      gfmFromMarkdown(),
    ],
  });
  return mdAst;
};

export const CLOUD_TOC_LIST = [
  "TOC-tidb-cloud.md",
  "TOC-tidb-cloud-essential.md",
  "TOC-tidb-cloud-starter.md",
  // "TOC-tidb-cloud-premium.md",
];

export const getAllMdList = (tocFiles) => {
  const tocFileList = Array.isArray(tocFiles) ? tocFiles : [tocFiles];

  const allLinks = tocFileList.flatMap((tocFile) => {
    if (!fs.existsSync(tocFile)) {
      console.log(`TOC file not found: ${tocFile}`);
      return [];
    }
    try {
      const tocFileContent = fs.readFileSync(tocFile);
      const mdAst = generateMdAstFromFile(tocFileContent);
      const linkList = extractLinkNodeFromAst(mdAst);
      return filterLink(linkList);
    } catch (error) {
      console.error(`Error reading TOC file ${tocFile}:`, error);
      return [];
    }
  });

  return [...new Set(allLinks)];
};
