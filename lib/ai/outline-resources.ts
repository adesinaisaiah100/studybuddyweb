import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { createYouTubeProvider } from "@/lib/ai/youtube-provider";

const ModuleSchema = z.object({
  title: z.string().min(2),
  summary: z.string().min(8),
  keywords: z.array(z.string()).min(2).max(8),
});

const OutlineSchema = z.object({
  courseTitle: z.string().min(3),
  overview: z.string().min(12),
  modules: z.array(ModuleSchema).min(2).max(12),
});

export type CourseOutline = z.infer<typeof OutlineSchema>;

type ResourceRow = {
  module_slug: string;
  module_title: string;
  resource_type: "web" | "youtube";
  title: string;
  url: string;
  source: string;
  score: number;
  metadata?: Record<string, unknown>;
};

type ResourceAgentResult = {
  rows: ResourceRow[];
  status: string;
};

const MIN_RESOURCES_PER_MODULE = 5;

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const normalizedPath = parsed.pathname.replace(/\/$/, "");
    return `${parsed.origin}${normalizedPath}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasGrounding(sourceText: string, candidate: string) {
  const normalizedSource = normalizeText(sourceText);
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedCandidate) return false;

  if (normalizedSource.includes(normalizedCandidate)) return true;

  const candidateTokens = normalizedCandidate
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);

  if (candidateTokens.length === 0) return false;

  const matched = candidateTokens.filter((token) => normalizedSource.includes(token)).length;
  return matched / candidateTokens.length >= 0.6;
}

function deriveGroundedKeywords(sourceText: string, title: string, existingKeywords: string[]) {
  const grounded = existingKeywords
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length >= 3)
    .filter((keyword) => hasGrounding(sourceText, keyword));

  if (grounded.length >= 2) return grounded.slice(0, 8);

  const titleTokens = title
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => hasGrounding(sourceText, token));

  const merged = Array.from(new Set([...grounded, ...titleTokens]));
  return merged.slice(0, 8);
}

function enforceGroundedOutline(sourceText: string, outline: CourseOutline): CourseOutline {
  const groundedModules = outline.modules
    .filter((module) => hasGrounding(sourceText, module.title))
    .map((module) => {
      const safeSummary = hasGrounding(sourceText, module.summary)
        ? module.summary
        : `Extracted module from uploaded text: ${module.title}`;
      const safeKeywords = deriveGroundedKeywords(sourceText, module.title, module.keywords);

      return {
        title: module.title,
        summary: safeSummary,
        keywords:
          safeKeywords.length >= 2
            ? safeKeywords
            : [module.title.split(" ")[0] || "module", "course"],
      };
    });

  const normalizedTitle = hasGrounding(sourceText, outline.courseTitle)
    ? outline.courseTitle
    : "Extracted Course Outline";
  const normalizedOverview = hasGrounding(sourceText, outline.overview)
    ? outline.overview
    : "Structured from uploaded course material text.";

  if (groundedModules.length >= 2) {
    return {
      courseTitle: normalizedTitle,
      overview: normalizedOverview,
      modules: groundedModules.slice(0, 12),
    };
  }

  const fallbackLines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8)
    .filter((line) => /module|week|unit|chapter|lesson|topic|^\d+[.)\-\s]/i.test(line))
    .slice(0, 12);

  const fallbackModules = fallbackLines.slice(0, 12).map((line, index) => ({
    title: line.slice(0, 120),
    summary: `Extracted from uploaded text section ${index + 1}.`,
    keywords: deriveGroundedKeywords(sourceText, line, []).slice(0, 8),
  }));

  const minSafeModules = fallbackModules.length >= 2
    ? fallbackModules
    : [
        {
          title: "Module 1",
          summary: "Extracted from uploaded text.",
          keywords: ["module", "course"],
        },
        {
          title: "Module 2",
          summary: "Extracted from uploaded text.",
          keywords: ["module", "course"],
        },
      ];

  return {
    courseTitle: normalizedTitle,
    overview: normalizedOverview,
    modules: minSafeModules.map((module) => ({
      ...module,
      keywords: module.keywords.length >= 2 ? module.keywords : ["module", "course"],
    })),
  };
}

function scoreResource(moduleTitle: string, keywords: string[], title: string, url: string) {
  const hay = `${title} ${url}`.toLowerCase();
  let score = 0;

  if (hay.includes(moduleTitle.toLowerCase())) score += 3;

  for (const keyword of keywords) {
    if (hay.includes(keyword.toLowerCase())) score += 1;
  }

  if (/\.edu|ocw|mit\.edu|coursera|edx|openstax|wikipedia|docs\./i.test(url)) {
    score += 2;
  }

  return score;
}

async function searchWebWithTavily(query: string): Promise<Array<{ title: string; url: string; source: string }>> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 10,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) return [];
  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];

  return results
    .map((entry: { title?: string; url?: string }) => ({
      title: entry?.title?.trim() || "Web Resource",
      url: entry?.url?.trim() || "",
      source: "tavily-search",
    }))
    .filter((entry: { title: string; url: string; source: string }) => Boolean(entry.url));
}

async function searchWikipedia(query: string): Promise<Array<{ title: string; url: string; source: string }>> {
  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
  );

  if (!response.ok) return [];
  const payload = await response.json();
  const results = Array.isArray(payload?.query?.search) ? payload.query.search : [];

  return results.slice(0, 8).map((entry: { title?: string }) => {
    const title = entry?.title?.trim() || "Wikipedia Topic";
    return {
      title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`,
      source: "wikipedia-search",
    };
  });
}

function dedupeAndRank(rows: ResourceRow[], limit = 8) {
  const map = new Map<string, ResourceRow>();

  for (const row of rows) {
    const key = normalizeUrl(row.url);
    const existing = map.get(key);

    if (!existing || row.score > existing.score) {
      map.set(key, row);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function deriveKeywordsFromTitle(moduleTitle: string) {
  return moduleTitle
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 4)
    .slice(0, 5);
}

async function youtubeResourcesForModule(
  courseTitle: string,
  moduleTitle: string,
  keywords: string[],
  minimumResults = MIN_RESOURCES_PER_MODULE
) {
  const provider = createYouTubeProvider();
  const moduleKeywords = keywords.length > 0 ? keywords : deriveKeywordsFromTitle(moduleTitle);

  const queryVariants = [
    `${courseTitle} ${moduleTitle} lecture`,
    `${moduleTitle} tutorial ${moduleKeywords.slice(0, 2).join(" ")}`,
    `${moduleTitle} full course class`,
  ];

  const collected: ResourceRow[] = [];

  for (const query of queryVariants) {
    const results = await provider.search(query, 10);
    for (const video of results) {
      collected.push({
        module_slug: slugify(moduleTitle),
        module_title: moduleTitle,
        resource_type: "youtube",
        title: video.title,
        url: video.url,
        source: "youtube-api",
        score: scoreResource(moduleTitle, moduleKeywords, video.title, video.url),
        metadata: {
          channelTitle: video.channelTitle,
          publishedAt: video.publishedAt,
        },
      });
    }

    if (dedupeAndRank(collected, minimumResults).length >= minimumResults) break;
  }

  const ranked = dedupeAndRank(collected, 12);
  if (ranked.length >= minimumResults) {
    return ranked.slice(0, minimumResults);
  }

  const fallbackRows = queryVariants.map((query, index) => ({
    module_slug: slugify(moduleTitle),
    module_title: moduleTitle,
    resource_type: "youtube" as const,
    title: `${moduleTitle} YouTube Search ${index + 1}`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    source: "youtube-search-fallback",
    score: scoreResource(moduleTitle, moduleKeywords, query, query),
  }));

  return dedupeAndRank([...ranked, ...fallbackRows], minimumResults).slice(0, minimumResults);
}

async function webResourcesForModule(
  moduleTitle: string,
  keywords: string[],
  minimumResults = MIN_RESOURCES_PER_MODULE
) {
  const moduleKeywords = keywords.length > 0 ? keywords : deriveKeywordsFromTitle(moduleTitle);
  const queryVariants = [
    `${moduleTitle} ${moduleKeywords.slice(0, 3).join(" ")} lecture notes textbook`,
    `${moduleTitle} syllabus study guide university`,
    `${moduleTitle} open courseware pdf`,
  ];

  const collected: ResourceRow[] = [];
  let providerStatus = process.env.TAVILY_API_KEY ? "enabled_tavily" : "fallback_wikipedia";

  for (const query of queryVariants) {
    const tavilyRows = await searchWebWithTavily(query);
    const wikiRows = tavilyRows.length > 0 ? [] : await searchWikipedia(query);

    if (tavilyRows.length === 0 && wikiRows.length > 0) {
      providerStatus = "fallback_wikipedia";
    }

    const rows = [...tavilyRows, ...wikiRows].map((entry) => ({
      module_slug: slugify(moduleTitle),
      module_title: moduleTitle,
      resource_type: "web" as const,
      title: entry.title,
      url: entry.url,
      source: entry.source,
      score: scoreResource(moduleTitle, moduleKeywords, entry.title, entry.url),
    }));

    collected.push(...rows);

    if (dedupeAndRank(collected, minimumResults).length >= minimumResults) break;
  }

  const ranked = dedupeAndRank(collected, 12);
  if (ranked.length >= minimumResults) {
    return { rows: ranked.slice(0, minimumResults), status: providerStatus };
  }

  const fallbackRows: ResourceRow[] = [
    `site:ocw.mit.edu ${moduleTitle}`,
    `site:openstax.org ${moduleTitle}`,
    `site:wikipedia.org ${moduleTitle}`,
    `site:coursera.org ${moduleTitle}`,
    `site:edx.org ${moduleTitle}`,
  ].map((query, index) => ({
    module_slug: slugify(moduleTitle),
    module_title: moduleTitle,
    resource_type: "web",
    title: `${moduleTitle} Study Resource ${index + 1}`,
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    source: "web-search-fallback",
    score: scoreResource(moduleTitle, moduleKeywords, query, query),
  }));

  return {
    rows: dedupeAndRank([...ranked, ...fallbackRows], minimumResults).slice(0, minimumResults),
    status: providerStatus,
  };
}

async function buildOutlineFromText(previewText: string): Promise<CourseOutline> {
  const modelName = process.env.OPENROUTER_OUTLINE_MODEL;
  if (!modelName) {
    throw new Error("Missing OPENROUTER_OUTLINE_MODEL env variable.");
  }

  const model = new ChatOpenAI({
    modelName,
    temperature: 0,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    },
  });

  const structured = model.withStructuredOutput(OutlineSchema);

  const extracted = await structured.invoke([
    {
      role: "system",
      content:
        "You are an extraction-only curriculum structuring engine. Return only valid JSON matching schema. Do NOT invent modules, topics, summaries, or keywords. Use only facts present in the uploaded text. If information is missing, keep wording conservative and generic.",
    },
    {
      role: "user",
      content: `Extract the existing course outline from this uploaded text and format it to schema:\n\n${previewText}`,
    },
  ]);

  return enforceGroundedOutline(previewText, extracted);
}

async function outlineExtractionAgent(previewText: string): Promise<CourseOutline> {
  return buildOutlineFromText(previewText);
}

async function youtubeResourcesAgent(outline: CourseOutline): Promise<ResourceAgentResult> {
  try {
    const youtubeRows: ResourceRow[] = [];

    for (const unit of outline.modules) {
      const moduleRows = await youtubeResourcesForModule(
        outline.courseTitle,
        unit.title,
        unit.keywords,
        MIN_RESOURCES_PER_MODULE
      );
      youtubeRows.push(...moduleRows);
    }

    return {
      rows: dedupeAndRank(youtubeRows, outline.modules.length * MIN_RESOURCES_PER_MODULE),
      status: process.env.YOUTUBE_API_KEY ? "enabled" : "disabled_no_api_key",
    };
  } catch (error) {
    console.error("[outline-resources] youtubeResourcesAgent failed", (error as Error).message);
    return { rows: [], status: "error" };
  }
}

async function webResourcesAgent(outline: CourseOutline): Promise<ResourceAgentResult> {
  try {
    const webRows: ResourceRow[] = [];
    const statuses = new Set<string>();
    for (const unit of outline.modules) {
      const moduleWeb = await webResourcesForModule(
        unit.title,
        unit.keywords,
        MIN_RESOURCES_PER_MODULE
      );
      webRows.push(...moduleWeb.rows);
      statuses.add(moduleWeb.status);
    }

    return {
      rows: dedupeAndRank(webRows, outline.modules.length * MIN_RESOURCES_PER_MODULE),
      status: Array.from(statuses).join("|") || "unknown",
    };
  } catch (error) {
    console.error("[outline-resources] webResourcesAgent failed", (error as Error).message);
    return { rows: [], status: "error" };
  }
}

export async function generateResourcesForModule(input: {
  courseTitle: string;
  moduleTitle: string;
  keywords?: string[];
}) {
  const keywords = (input.keywords || []).filter((keyword) => keyword.trim().length >= 2);

  const [youtubeRows, webResult] = await Promise.all([
    youtubeResourcesForModule(
      input.courseTitle,
      input.moduleTitle,
      keywords,
      MIN_RESOURCES_PER_MODULE
    ),
    webResourcesForModule(input.moduleTitle, keywords, MIN_RESOURCES_PER_MODULE),
  ]);

  return {
    moduleSlug: slugify(input.moduleTitle),
    youtube: youtubeRows,
    web: webResult.rows,
    youtubeStatus: process.env.YOUTUBE_API_KEY ? "enabled" : "disabled_no_api_key",
    webStatus: webResult.status,
  };
}

async function orchestrateOutlineAndResources(previewText: string) {
  const outline = await outlineExtractionAgent(previewText);

  const [webResult, youtubeResult] = await Promise.all([
    webResourcesAgent(outline),
    youtubeResourcesAgent(outline),
  ]);

  return {
    outline,
    resources: {
      web: webResult.rows,
      youtube: youtubeResult.rows,
      youtubeStatus: youtubeResult.status,
      webStatus: webResult.status,
    },
  };
}

export async function generateOutlineAndResources(previewText: string) {
  if (!previewText?.trim()) {
    throw new Error("Preview text is empty for outline generation.");
  }

  return orchestrateOutlineAndResources(previewText);
}
