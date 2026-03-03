const GITHUB_HANDLE_REGEX = /@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})/g;
const GITHUB_REPO_REGEX =
  /\b(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9_.-]{1,100}\b/g;

const sortMatches = (matches) =>
  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });

const collectRegexMatches = (text, regex) => {
  const matches = [];
  regex.lastIndex = 0;
  let match = regex.exec(text);
  while (match) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
    });
    match = regex.exec(text);
  }
  return matches;
};

const mergeMatches = (matches) => {
  const merged = [];
  for (const current of sortMatches(matches)) {
    const prev = merged[merged.length - 1];
    if (!prev || current.start >= prev.end) {
      merged.push(current);
      continue;
    }

    // Keep the wider match when ranges overlap.
    if (current.end > prev.end) {
      prev.end = current.end;
      prev.value = prev.value.slice(0, current.start - prev.start) + current.value;
    }
  }
  return merged;
};

export const createGitHubIdProtector = (
  text = "",
  { useNoTranslateSpan = false } = {}
) => {
  if (!text || typeof text !== "string") {
    return {
      text,
      restore: (translated = "") => translated,
    };
  }

  const matches = mergeMatches([
    ...collectRegexMatches(text, GITHUB_REPO_REGEX),
    ...collectRegexMatches(text, GITHUB_HANDLE_REGEX),
  ]);

  if (!matches.length) {
    return {
      text,
      restore: (translated = "") => translated,
    };
  }

  const placeholders = [];
  let protectedText = "";
  let cursor = 0;

  matches.forEach((match, idx) => {
    const marker = `GITHUB_ID_PLACEHOLDER_${idx}`;
    placeholders.push({ marker, value: match.value });
    protectedText += text.slice(cursor, match.start);
    protectedText += useNoTranslateSpan
      ? `<span translate="no">${marker}</span>`
      : marker;
    cursor = match.end;
  });
  protectedText += text.slice(cursor);

  const restore = (translated = "") => {
    if (!translated || typeof translated !== "string") return translated;

    return placeholders.reduce((acc, item) => {
      const spanMarker = `<span translate="no">${item.marker}</span>`;
      return acc.replaceAll(spanMarker, item.value).replaceAll(item.marker, item.value);
    }, translated);
  };

  return {
    text: protectedText,
    restore,
  };
};
