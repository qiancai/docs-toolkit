const GENERIC_PLACEHOLDER_REGEX = /<span translate="no">([0-9]+)<\/span>/g;
const LINK_PLACEHOLDER_ATTR = "data-docs-link-placeholder";
const LINK_PLACEHOLDER_REGEX = new RegExp(
  `<a\\b[^>]*${LINK_PLACEHOLDER_ATTR}=["'](\\d+)["'][^>]*>[\\s\\S]*?<\\/a>`,
  "gi"
);

const escapeHtml = (text = "") =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const createLinkPlaceholderHtml = (index, href, text) => {
  const safeHref = escapeHtml(href);
  const safeText = escapeHtml(text);
  return `<a href="${safeHref}" translate="no" ${LINK_PLACEHOLDER_ATTR}="${index}">${safeText}</a>`;
};

export const restorePreservedPlaceholders = (html = "") => {
  const withLinkMarkers = html.replaceAll(LINK_PLACEHOLDER_REGEX, (_, index) => {
    return `{{B-PLACEHOLDER-${index}-PLACEHOLDER-E}}`;
  });

  return withLinkMarkers.replaceAll(GENERIC_PLACEHOLDER_REGEX, (_, index) => {
    return `{{B-PLACEHOLDER-${index}-PLACEHOLDER-E}}`;
  });
};
