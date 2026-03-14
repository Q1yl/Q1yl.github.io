const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "网安");
const POSTS_PATH = path.join(ROOT, "data", "posts.json");
const SITE_PATH = path.join(ROOT, "data", "site.json");
const SUMMARY_PATH = path.join(ROOT, "data", "import-summary.json");

const CATEGORY_ORDER = [
  "基础入门",
  "信息收集与工具",
  "Web 漏洞与利用",
  "内网与红队",
  "应急响应与蓝队",
  "数据库与中间件",
  "漏洞报告与案例",
  "项目复盘与教学",
  "参考资料",
  "草稿与随记",
];

const DRAFT_KEYWORDS = ["草稿", "记事本", "调教ai", "调教AI", "自传", "ppt制作", "剽窃他人成果"];
const WEB_KEYWORDS = ["xss", "sql", "注入", "ssrf", "xxe", "csrf", "rce", "框架", "逻辑漏洞", "任意文件", "webshell"];
const REDTEAM_KEYWORDS = ["内网", "横向", "cobalt", "ms17", "arp", "dns", "票据", "隐藏用户", "上线", "粘滞键", "穿透"];
const IR_KEYWORDS = ["应急", "日志", "evtx", "emlog", "blueteam", "blue team", "排查", "后门", "权限维持", "入侵"];
const DB_KEYWORDS = ["mysql", "redis", "oracle", "mssql", "sqlmap", "数据库", "udf", "mof"];
const RECON_KEYWORDS = ["信息收集", "fofa", "搜索语法", "抓包", "burp", "reqable", "sunnynet", "fiddler", "nuclei", "端口"];

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".obsidian") {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
      continue;
    }
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") {
      results.push(fullPath);
    }
  }
  return results;
}

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\\/g, "-")
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>-]/g, " ")
    .replace(/\|/g, " ")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function applyInline(text) {
  let value = escapeHtml(text);
  value = value.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return value;
}

function markdownToHtml(markdown) {
  const codeBlocks = [];
  const withTokens = markdown.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang = "", code = "") => {
    const token = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(
      `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${escapeHtml(
        code.trimEnd()
      )}</code></pre>`
    );
    return token;
  });

  const lines = withTokens.replace(/\r/g, "").split("\n");
  const html = [];
  let paragraph = [];
  let listType = "";
  let listItems = [];
  let quoteLines = [];

  function flushParagraph() {
    if (!paragraph.length) {
      return;
    }
    const content = paragraph.join(" ").trim();
    if (content) {
      html.push(`<p>${applyInline(content)}</p>`);
    }
    paragraph = [];
  }

  function flushList() {
    if (!listItems.length) {
      return;
    }
    const tag = listType === "ol" ? "ol" : "ul";
    html.push(`<${tag}>${listItems.map((item) => `<li>${applyInline(item)}</li>`).join("")}</${tag}>`);
    listItems = [];
    listType = "";
  }

  function flushQuote() {
    if (!quoteLines.length) {
      return;
    }
    html.push(`<blockquote>${quoteLines.map((line) => `<p>${applyInline(line)}</p>`).join("")}</blockquote>`);
    quoteLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const codeMatch = line.match(/^__CODE_BLOCK_(\d+)__$/);
    if (codeMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      html.push(codeBlocks[Number(codeMatch[1])]);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${applyInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedMatch[1]);
      continue;
    }

    const unorderedMatch = line.match(/^[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(unorderedMatch[1]);
      continue;
    }

    if (/^\|.*\|$/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      html.push(`<pre><code>${escapeHtml(line)}</code></pre>`);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushQuote();

  return html.join("");
}

function unique(array) {
  return [...new Set(array.filter(Boolean))];
}

function pickCategory(relativePath, title) {
  const rel = relativePath.toLowerCase();
  const lowerTitle = title.toLowerCase();

  if (rel.includes("剽窃他人成果")) {
    return "参考资料";
  }
  if (rel.includes("漏洞报告")) {
    return "漏洞报告与案例";
  }
  if (rel.includes("项目经验")) {
    return "项目复盘与教学";
  }
  if (rel.includes("应急响应笔记")) {
    return "应急响应与蓝队";
  }
  if (rel.includes("课程笔记\\基础入门")) {
    return "基础入门";
  }
  if (rel.includes("课程笔记\\红队") || rel.includes("26寒假线下笔记\\内网")) {
    return "内网与红队";
  }
  if (rel.includes("26寒假线下笔记\\数据库")) {
    return "数据库与中间件";
  }
  if (rel.includes("课程笔记\\漏洞基础") || rel.includes("课程笔记\\漏洞进阶")) {
    return "Web 漏洞与利用";
  }

  if (RECON_KEYWORDS.some((item) => lowerTitle.includes(item))) {
    return "信息收集与工具";
  }
  if (DB_KEYWORDS.some((item) => lowerTitle.includes(item))) {
    return "数据库与中间件";
  }
  if (IR_KEYWORDS.some((item) => lowerTitle.includes(item))) {
    return "应急响应与蓝队";
  }
  if (REDTEAM_KEYWORDS.some((item) => lowerTitle.includes(item))) {
    return "内网与红队";
  }
  if (WEB_KEYWORDS.some((item) => lowerTitle.includes(item))) {
    return "Web 漏洞与利用";
  }
  if (lowerTitle.includes("草稿") || lowerTitle.includes("记事") || lowerTitle.includes("心得")) {
    return "草稿与随记";
  }
  if (rel.includes("渗透知识库")) {
    return "信息收集与工具";
  }
  if (rel.includes("作业")) {
    return "内网与红队";
  }
  return "草稿与随记";
}

function pickStatus(relativePath, title) {
  const all = `${relativePath} ${title}`.toLowerCase();
  if (relativePath.includes("漏洞报告") || relativePath.includes("剽窃他人成果")) {
    return "draft";
  }
  if (DRAFT_KEYWORDS.some((item) => all.includes(item.toLowerCase()))) {
    return "draft";
  }
  return "published";
}

function buildTags(relativePath, title, category) {
  const parts = relativePath
    .split(path.sep)
    .slice(0, -1)
    .filter(Boolean)
    .filter((part) => part !== "网安" && part !== ".obsidian");

  const keywordTags = [];
  const lowerTitle = title.toLowerCase();
  if (WEB_KEYWORDS.some((item) => lowerTitle.includes(item))) keywordTags.push("Web");
  if (REDTEAM_KEYWORDS.some((item) => lowerTitle.includes(item))) keywordTags.push("内网");
  if (IR_KEYWORDS.some((item) => lowerTitle.includes(item))) keywordTags.push("应急");
  if (DB_KEYWORDS.some((item) => lowerTitle.includes(item))) keywordTags.push("数据库");
  if (RECON_KEYWORDS.some((item) => lowerTitle.includes(item))) keywordTags.push("信息收集");

  return unique([category, ...parts.slice(-3), ...keywordTags]).slice(0, 8);
}

function buildPost(filePath, usedSlugs) {
  const relativePath = path.relative(ROOT, filePath);
  const relativeFromNetsec = path.relative(SOURCE_DIR, filePath);
  const source = fs.readFileSync(filePath, "utf8");
  const stats = fs.statSync(filePath);
  const cleanTitle = path.basename(filePath, ".md").replace(/\s+/g, " ").trim();
  const plain = stripMarkdown(source);
  const excerpt = (plain || cleanTitle).slice(0, 90);
  const category = pickCategory(relativePath, cleanTitle);
  const status = pickStatus(relativePath, cleanTitle);
  let slug = slugify(relativeFromNetsec.replace(/\.md$/i, ""));
  if (!slug) {
    slug = slugify(cleanTitle);
  }
  while (usedSlugs.has(slug)) {
    slug = `${slug}-${usedSlugs.size + 1}`;
  }
  usedSlugs.add(slug);

  return {
    slug,
    title: cleanTitle,
    excerpt,
    description: excerpt,
    publishedAt: formatDate(stats.birthtime || stats.mtime),
    updatedAt: formatDate(stats.mtime),
    category,
    tags: buildTags(relativePath, cleanTitle, category),
    status,
    cover: "/img/cover-security.svg",
    wordCount: plain.length,
    editorMode: "markdown",
    rawBody: source.trim(),
    contentHtml: markdownToHtml(source),
    sourcePath: relativePath.replaceAll("\\", "/"),
  };
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`未找到目录: ${SOURCE_DIR}`);
  }

  const usedSlugs = new Set();
  const files = walk(SOURCE_DIR).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const posts = files.map((filePath) => buildPost(filePath, usedSlugs));
  posts.sort((a, b) => {
    const categoryDiff =
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (categoryDiff !== 0) {
      return categoryDiff;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  fs.writeFileSync(POSTS_PATH, `${JSON.stringify(posts, null, 2)}\n`);

  const site = JSON.parse(fs.readFileSync(SITE_PATH, "utf8"));
  site.notice = `已从网安资料库导入 ${posts.length} 篇笔记，敏感报告与参考资料默认进入草稿。`;
  fs.writeFileSync(SITE_PATH, `${JSON.stringify(site, null, 2)}\n`);

  const summary = {
    total: posts.length,
    published: posts.filter((item) => item.status === "published").length,
    draft: posts.filter((item) => item.status === "draft").length,
    categories: CATEGORY_ORDER.map((name) => ({
      name,
      count: posts.filter((item) => item.category === name).length,
    })).filter((item) => item.count > 0),
  };
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`Imported ${summary.total} notes`);
  console.log(JSON.stringify(summary, null, 2));
}

main();
