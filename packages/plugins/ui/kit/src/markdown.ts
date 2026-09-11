import { marked } from "marked";

const markdownCache = new Map<string, string>();
const MARKDOWN_CACHE_LIMIT = 512;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Raw HTML in a local markdown file must not execute in the host page.
const renderer = new marked.Renderer();
renderer.html = ({ text }) => escapeHtml(text);

/**
 * Renders GitHub-flavoured markdown to HTML with a small revision cache. Shared
 * by the transcript and the file editor so both render tables and code alike.
 */
export function renderMarkdownHtml(text: string): string {
  const cached = markdownCache.get(text);
  if (cached !== undefined) return cached;
  const html = marked.parse(text, {
    gfm: true,
    breaks: true,
    renderer,
  }) as string;
  if (markdownCache.size >= MARKDOWN_CACHE_LIMIT) {
    const oldest = markdownCache.keys().next().value;
    if (oldest !== undefined) markdownCache.delete(oldest);
  }
  markdownCache.set(text, html);
  return html;
}
