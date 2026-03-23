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

type GenerateResourcesOptions = {
  minimumResults?: number;
};

type ResourceAgentResult = {
  rows: ResourceRow[];
  status: string;
};

const MIN_RESOURCES_PER_MODULE = 18;
const MAX_RESOURCES_PER_MODULE = 80;
const WEB_RESULTS_PER_QUERY = 20;
const YOUTUBE_RESULTS_PER_QUERY = 30;
const YOUTUBE_MAX_PAGES_BASE = 2;
const YOUTUBE_MAX_PAGES_LOAD_MORE = 3;

type GoogleSearchResource = {
  title: string;
  url: string;
  snippet?: string;
};

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isTechnicalCourse(courseTitle: string): boolean {
  const technicalKeywords = /engineering|electrical|software|computer|programming|math|physics|chemistry|biology|science|technology|IT|tech|telecommunications|electronics|automation|control|systems/i;
  return technicalKeywords.test(courseTitle);
}

function isRelevantEducationalSource(url: string, title: string): boolean {
  // Reject obvious non-educational content
  const nonEducationalPatterns = /movie|film|actor|actress|character|tv show|episode|trailer|streaming|imdb|rotten|company|sports|athlete|player|game|gaming|social media|facebook|twitter|linkedin|instagram/i;
  if (nonEducationalPatterns.test(title.toLowerCase())) {
    return false;
  }

  const urlLower = url.toLowerCase();

  // Prefer educational/academic domains
  const preferredDomains = /\.edu\b|ocw\.mit\.edu|coursera\.com|udemy\.com|khan|arxiv|ieee\.org|springer|researchgate|scholar\.google|techsmith|linktopastthefuture|open\.edx/i;
  if (preferredDomains.test(urlLower)) {
    return true;
  }

  // Reject known non-academic domains
  const rejectedDomains = /imdb\.com|fandom|reddit\.com\/r\/(movies|television|gaming)|twitter\.com|facebook\.com|instagram\.com|youtube\.com\/channel|pinterest\.com|tiktok\.com|twitch\.tv/i;
  if (rejectedDomains.test(urlLower)) {
    return false;
  }

  // Keep Wikipedia only when likely educational (avoid noisy list pages)
  if (/wikipedia\.org/.test(urlLower) && /^list of\b/i.test(title.trim())) {
    return false;
  }

  // Generic tech/engineering sites are usually OK
  if (/github\.com|stackoverflow\.com|developer|docs\.|api\.|\.dev\b/i.test(urlLower)) {
    return true;
  }

  return true;
}

function isDirectYouTubeVideoUrl(url: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (hostname === "youtube.com") {
      return parsed.pathname === "/watch" && parsed.searchParams.has("v");
    }

    if (hostname === "youtu.be") {
      return parsed.pathname.length > 1;
    }

    return false;
  } catch {
    return false;
  }
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

function scoreResource(
  moduleTitle: string,
  moduleSummary: string,
  keywords: string[],
  subtopic: string,
  title: string,
  url: string
) {
  const hay = `${title} ${url}`.toLowerCase();
  let score = 0;

  if (hay.includes(moduleTitle.toLowerCase())) score += 3;
  if (moduleSummary && hay.includes(moduleSummary.toLowerCase().slice(0, 40))) score += 2;
  if (subtopic && hay.includes(subtopic.toLowerCase())) score += 2;

  for (const keyword of keywords) {
    if (hay.includes(keyword.toLowerCase())) score += 1;
  }

  if (/\.edu|ocw|mit\.edu|coursera|edx|openstax|wikipedia|docs\./i.test(url)) {
    score += 2;
  }

  if (/youtube\.com\/watch\?v=|youtu\.be\//i.test(url)) {
    score += 1;
  }

  if (/\b(movie|film|actor|actress|character|episode|trailer|streaming|imdb|fandom|sports|gaming)\b/i.test(title)) {
    score -= 5;
  }

  if (/\b(list of|disambiguation)\b/i.test(title)) {
    score -= 3;
  }

  return score;
}

function buildQueryVariants(
  courseTitle: string,
  moduleTitle: string,
  moduleSummary: string,
  keywords: string[],
  resourceType: "web" | "youtube"
) {
  const summaryPhrase = moduleSummary
    .split(/[.;,\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4)[0] || moduleTitle;
  const keywordText = keywordBundle(keywords);
  const disciplineSuffix = isTechnicalCourse(courseTitle) ? " engineering technical course" : " educational course";

  const youtubeQueries = [
    `${courseTitle} ${moduleTitle} ${keywordText} lecture`.trim(),
    `${moduleTitle} ${summaryPhrase} tutorial`.trim(),
    `${moduleTitle} ${keywordText} explained`.trim(),
    `${courseTitle} ${moduleTitle} ${summaryPhrase} full class`.trim(),
    `${moduleTitle} ${keywordText} walkthrough examples`.trim(),
  ];

  const webQueries = [
    `${courseTitle} ${moduleTitle} ${keywordText} lecture notes pdf${disciplineSuffix}`.trim(),
    `${moduleTitle} ${summaryPhrase} university syllabus${disciplineSuffix}`.trim(),
    `${moduleTitle} ${keywordText} open courseware${disciplineSuffix}`.trim(),
    `${moduleTitle} ${summaryPhrase} textbook chapter${disciplineSuffix}`.trim(),
    `${moduleTitle} ${keywordText} practice problems${disciplineSuffix}`.trim(),
  ];

  const seed = resourceType === "youtube" ? youtubeQueries : webQueries;
  return Array.from(new Set(seed.map((query) => query.replace(/\s+/g, " ").trim()))).slice(0, 6);
}

async function searchWebWithTavily(query: string, maxResults = WEB_RESULTS_PER_QUERY): Promise<Array<{ title: string; url: string; source: string }>> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: clamp(maxResults, 5, 30),
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

async function searchWebWithGoogleModel(input: {
  query: string;
  moduleTitle: string;
  moduleSummary: string;
  keywords: string[];
  maxResults?: number;
}): Promise<Array<{ title: string; url: string; source: string; snippet?: string }>> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const model = process.env.GOOGLE_SEARCH_MODEL;
  if (!apiKey || !model) return [];

  const prompt = [
    "Use Google Search tool results only.",
    `Find high-quality educational web resources for: ${input.query}`,
    `Module: ${input.moduleTitle}`,
    `Module summary: ${input.moduleSummary || "N/A"}`,
    `Module keywords: ${input.keywords.join(", ") || "N/A"}`,
    "Context: prioritize electrical engineering / STEM educational material where applicable.",
    "Include only resources that directly teach the topic (lecture notes, textbooks, university pages, technical docs, research/tutorial pages).",
    "Exclude entertainment content (movies, TV, fandom pages), social media, and biography/list pages unless strictly technical and instructional.",
    `Return JSON object with shape {\"resources\":[{\"title\":string,\"url\":string,\"snippet\":string}]}`,
    `Return at most ${clamp(input.maxResults ?? WEB_RESULTS_PER_QUERY, 10, 30)} resources.`,
    "Use direct page URLs, not search engine result pages.",
    "Avoid ambiguous topic collisions (for example: Transformers franchise vs electrical transformers) and choose domain-specific technical resources.",
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) return [];
  const payload = await response.json();
  const textParts = (payload?.candidates?.[0]?.content?.parts || [])
    .map((part: { text?: string }) => part?.text || "")
    .filter((part: string) => part.trim().length > 0);

  if (textParts.length === 0) return [];

  try {
    const parsed = JSON.parse(textParts.join("\n")) as {
      resources?: GoogleSearchResource[];
    };
    const resources = Array.isArray(parsed?.resources) ? parsed.resources : [];

    return resources
      .map((entry) => ({
        title: String(entry?.title || "").trim() || "Web Resource",
        url: String(entry?.url || "").trim(),
        source: "google-model-search",
        snippet: String(entry?.snippet || "").trim(),
      }))
      .filter((entry) => {
        if (!entry.url) return false;
        try {
          const parsedUrl = new URL(entry.url);
          return /^https?:$/.test(parsedUrl.protocol);
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
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

function keywordBundle(keywords: string[]) {
  return keywords
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length >= 3)
    .slice(0, 4)
    .join(" ");
}

async function youtubeResourcesForModule(
  courseTitle: string,
  moduleTitle: string,
  moduleSummary: string,
  keywords: string[],
  minimumResults = MIN_RESOURCES_PER_MODULE
) {
  const provider = createYouTubeProvider();
  const moduleKeywords = keywords.length > 0 ? keywords : deriveKeywordsFromTitle(moduleTitle);
  const queryVariants = buildQueryVariants(
    courseTitle,
    moduleTitle,
    moduleSummary,
    moduleKeywords,
    "youtube"
  );

  const collected: ResourceRow[] = [];
  const pageLimit = minimumResults > MIN_RESOURCES_PER_MODULE
    ? YOUTUBE_MAX_PAGES_LOAD_MORE
    : YOUTUBE_MAX_PAGES_BASE;

  for (const query of queryVariants) {
    let nextPageToken: string | undefined;
    let fetchedPages = 0;

    while (fetchedPages < pageLimit) {
      const page = await provider.searchPage(
        query,
        YOUTUBE_RESULTS_PER_QUERY,
        nextPageToken
      );

      for (const video of page.items) {
        if (!isDirectYouTubeVideoUrl(video.url)) continue;
        collected.push({
          module_slug: slugify(moduleTitle),
          module_title: moduleTitle,
          resource_type: "youtube",
          title: video.title,
          url: video.url,
          source: "youtube-api",
          score: scoreResource(
            moduleTitle,
            moduleSummary,
            moduleKeywords,
            keywordBundle(moduleKeywords),
            video.title,
            video.url
          ),
          metadata: {
            query,
            channelTitle: video.channelTitle,
            publishedAt: video.publishedAt,
            moduleSummary,
            keywords: moduleKeywords,
          },
        });
      }

      fetchedPages += 1;
      nextPageToken = page.nextPageToken;

      if (!nextPageToken) break;
      if (dedupeAndRank(collected, minimumResults).length >= minimumResults) break;
    }

    if (dedupeAndRank(collected, minimumResults).length >= minimumResults) break;
  }

  return dedupeAndRank(
    collected.filter((row) => row.score >= 2),
    clamp(minimumResults, 4, MAX_RESOURCES_PER_MODULE)
  );
}

async function webResourcesForModule(
  courseTitle: string,
  moduleTitle: string,
  moduleSummary: string,
  keywords: string[],
  minimumResults = MIN_RESOURCES_PER_MODULE
) {
  const moduleKeywords = keywords.length > 0 ? keywords : deriveKeywordsFromTitle(moduleTitle);
  const queryVariants = buildQueryVariants(
    courseTitle,
    moduleTitle,
    moduleSummary,
    moduleKeywords,
    "web"
  );

  const collected: ResourceRow[] = [];
  let providerStatus = process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_MODEL
    ? "enabled_google_model_search"
    : process.env.TAVILY_API_KEY
      ? "enabled_tavily"
      : "fallback_wikipedia";

  for (const query of queryVariants) {
    const googleRows = await searchWebWithGoogleModel({
      query,
      moduleTitle,
      moduleSummary,
      keywords: moduleKeywords,
      maxResults: WEB_RESULTS_PER_QUERY,
    });

    const tavilyRows = googleRows.length > 0 ? [] : await searchWebWithTavily(query, WEB_RESULTS_PER_QUERY);
    const wikiRows = googleRows.length > 0 || tavilyRows.length > 0
      ? []
      : await searchWikipedia(`${moduleTitle} ${keywordBundle(moduleKeywords)}`);

    if (googleRows.length === 0 && tavilyRows.length === 0 && wikiRows.length > 0) {
      providerStatus = "fallback_wikipedia";
    }
    if (googleRows.length === 0 && tavilyRows.length > 0 && providerStatus !== "enabled_google_model_search") {
      providerStatus = "enabled_tavily";
    }

    const rows = [...googleRows, ...tavilyRows, ...wikiRows]
      .filter((entry) => isRelevantEducationalSource(entry.url, entry.title))
      .map((entry) => ({
        module_slug: slugify(moduleTitle),
        module_title: moduleTitle,
        resource_type: "web" as const,
        title: entry.title,
        url: entry.url,
        source: entry.source,
        score: scoreResource(
          moduleTitle,
          moduleSummary,
          moduleKeywords,
          keywordBundle(moduleKeywords),
          entry.title,
          entry.url
        ),
        metadata: {
          query,
          snippet: "snippet" in entry ? entry.snippet : undefined,
          moduleSummary,
          keywords: moduleKeywords,
        },
      }));

    collected.push(...rows);
  }

  return {
    rows: dedupeAndRank(
      collected.filter((row) => row.score >= 2),
      clamp(minimumResults, 4, MAX_RESOURCES_PER_MODULE)
    ),
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
        unit.summary,
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
        outline.courseTitle,
        unit.title,
        unit.summary,
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
  moduleSummary?: string;
  keywords?: string[];
  options?: GenerateResourcesOptions;
}) {
  const keywords = (input.keywords || []).filter((keyword) => keyword.trim().length >= 2);
  const minimumResults = clamp(
    input.options?.minimumResults ?? MIN_RESOURCES_PER_MODULE,
    4,
    MAX_RESOURCES_PER_MODULE
  );

  const [youtubeRows, webResult] = await Promise.all([
    youtubeResourcesForModule(
      input.courseTitle,
      input.moduleTitle,
      input.moduleSummary || "",
      keywords,
      minimumResults
    ),
    webResourcesForModule(
      input.courseTitle,
      input.moduleTitle,
      input.moduleSummary || "",
      keywords,
      minimumResults
    ),
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
