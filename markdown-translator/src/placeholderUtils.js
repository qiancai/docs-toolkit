const PLACEHOLDER_TOKEN_REGEX = /(\{\{B-PLACEHOLDER-\d+-PLACEHOLDER-E\}\})/g;
const PLACEHOLDER_INDEX_REGEX = /^\{\{B-PLACEHOLDER-(\d+)-PLACEHOLDER-E\}\}$/;

const getPlaceholderIndex = (token) => {
  const match = token.match(PLACEHOLDER_INDEX_REGEX);
  return match ? Number(match[1]) : null;
};

const isPlaceholderToken = (token) => getPlaceholderIndex(token) !== null;

const getLinkText = (metaEntry) => {
  if (!metaEntry || metaEntry.kind !== "link") {
    return "";
  }
  return metaEntry.text || "";
};

const stripTrailingDuplicate = (text, duplicate) => {
  if (!duplicate || !text) {
    return text;
  }

  const trailingWhitespace = text.match(/\s*$/)?.[0] ?? "";
  const core = text.slice(0, text.length - trailingWhitespace.length);
  if (!core.endsWith(duplicate)) {
    return text;
  }

  const prefix = core.slice(0, -duplicate.length);
  if (!prefix) {
    return "";
  }

  const separator = /\s$/.test(prefix) ? "" : trailingWhitespace;
  return `${prefix}${separator}`;
};

const stripLeadingDuplicate = (text, duplicate) => {
  if (!duplicate || !text) {
    return text;
  }

  const leadingWhitespace = text.match(/^\s*/)?.[0] ?? "";
  const core = text.slice(leadingWhitespace.length);
  if (!core.startsWith(duplicate)) {
    return text;
  }

  const suffix = core.slice(duplicate.length);
  if (!suffix) {
    return "";
  }

  const separator = /^\s/.test(suffix) ? "" : leadingWhitespace;
  return `${separator}${suffix}`;
};

export const stripDuplicateLinkTextAroundPlaceholders = (resultStr, meta = {}) => {
  const parts = resultStr.split(PLACEHOLDER_TOKEN_REGEX);

  for (let i = 0; i < parts.length; i++) {
    const placeholderIndex = getPlaceholderIndex(parts[i]);
    if (placeholderIndex === null) {
      continue;
    }

    const linkText = getLinkText(meta[placeholderIndex]);
    if (!linkText) {
      continue;
    }

    if (i > 0 && !isPlaceholderToken(parts[i - 1])) {
      parts[i - 1] = stripTrailingDuplicate(parts[i - 1], linkText);
    }

    if (i + 1 < parts.length && !isPlaceholderToken(parts[i + 1])) {
      parts[i + 1] = stripLeadingDuplicate(parts[i + 1], linkText);
    }
  }

  return parts.join("");
};
