import * as fs from "fs";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

const splitYamlComment = (text) => {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === `"` && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      if (i === 0 || /\s/.test(text[i - 1])) {
        return [text.slice(0, i), text.slice(i)];
      }
    }
  }

  return [text, ""];
};

const splitYamlInlineArrayItems = (inner) => {
  const items = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }
    if (char === `"` && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (char === "," && !inSingleQuote && !inDoubleQuote) {
      items.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  items.push(current);
  return items;
};

const isUrlWithScheme = (value) => /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);

const applyLangPrefixToAliasPath = (aliasPath, langPrefix) => {
  const normalized = aliasPath.trim();
  if (!normalized) return aliasPath;
  if (isUrlWithScheme(normalized)) return normalized;

  const expectedPrefix = `/${langPrefix}`;
  if (
    normalized === expectedPrefix ||
    normalized.startsWith(`${expectedPrefix}/`)
  ) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    return `${expectedPrefix}${normalized}`;
  }
  return `${expectedPrefix}/${normalized}`;
};

const updateYamlAliasValue = (valueAndComment, langPrefix) => {
  const [beforeComment, comment] = splitYamlComment(valueAndComment);

  const leadingWhitespace = beforeComment.match(/^\s*/)?.[0] ?? "";
  const trailingWhitespace = beforeComment.match(/\s*$/)?.[0] ?? "";
  const core = beforeComment.slice(
    leadingWhitespace.length,
    beforeComment.length - trailingWhitespace.length
  );

  const coreTrimmed = core.trim();
  if (!coreTrimmed) {
    return `${beforeComment}${comment}`;
  }

  let quote = null;
  if (
    (coreTrimmed.startsWith("'") && coreTrimmed.endsWith("'")) ||
    (coreTrimmed.startsWith('"') && coreTrimmed.endsWith('"'))
  ) {
    quote = coreTrimmed[0];
  }

  const rawValue = quote ? coreTrimmed.slice(1, -1) : coreTrimmed;
  const updatedValue = applyLangPrefixToAliasPath(rawValue, langPrefix);
  const updatedCore = quote ? `${quote}${updatedValue}${quote}` : updatedValue;

  return `${leadingWhitespace}${updatedCore}${trailingWhitespace}${comment}`;
};

const updateAliasesInYamlFrontmatter = (yaml, langPrefix) => {
  const newline = yaml.includes("\r\n") ? "\r\n" : "\n";
  const lines = yaml.split(/\r?\n/);
  const output = [];

  let inAliasesList = false;
  let aliasesIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inAliasesList) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) {
        output.push(line);
        continue;
      }

      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (indent <= aliasesIndent) {
        inAliasesList = false;
        i--;
        continue;
      }

      const listItemMatch = line.match(/^(\s*-\s*)(.*)$/);
      if (!listItemMatch) {
        output.push(line);
        continue;
      }

      const prefix = listItemMatch[1];
      const rest = listItemMatch[2];
      output.push(`${prefix}${updateYamlAliasValue(rest, langPrefix)}`);
      continue;
    }

    const inlineMatch = line.match(
      /^(\s*aliases\s*:\s*)\[(.*)\](\s*(#.*)?)?$/
    );
    if (inlineMatch) {
      const left = inlineMatch[1];
      const inner = inlineMatch[2];
      const right = inlineMatch[3] ?? "";
      const items = splitYamlInlineArrayItems(inner);
      const updatedInner = items
        .map((item) => updateYamlAliasValue(item, langPrefix))
        .join(",");
      output.push(`${left}[${updatedInner}]${right}`);
      continue;
    }

    const listStartMatch = line.match(/^(\s*)aliases\s*:\s*(#.*)?$/);
    if (listStartMatch) {
      inAliasesList = true;
      aliasesIndent = listStartMatch[1].length;
      output.push(line);
      continue;
    }

    output.push(line);
  }

  return output.join(newline);
};

export const updateMarkdownFrontmatterAliases = (markdown, langPrefix) => {
  const match = markdown.match(FRONTMATTER_REGEX);
  if (!match) return markdown;

  const originalYaml = match[1];
  const suffix = match[2] ?? "";
  const newline = match[0].includes("\r\n") ? "\r\n" : "\n";

  const updatedYaml = updateAliasesInYamlFrontmatter(originalYaml, langPrefix);
  if (updatedYaml === originalYaml) {
    return markdown;
  }

  return markdown.replace(
    FRONTMATTER_REGEX,
    `---${newline}${updatedYaml}${newline}---${suffix}`
  );
};

export const postProcessFileFrontmatterAliases = (filePath, langPrefix) => {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  const updatedContent = updateMarkdownFrontmatterAliases(content, langPrefix);

  if (updatedContent !== content) {
    fs.writeFileSync(filePath, updatedContent);
  }
};

