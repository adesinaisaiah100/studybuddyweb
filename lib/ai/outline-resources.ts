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

async function searchWeb(moduleTitle: string, keywords: string[]) {
  const query = `${moduleTitle} ${keywords.slice(0, 3).join(" ")} lecture notes textbook syllabus`;
  const response = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`
  );

  if (!response.ok) return [] as ResourceRow[];
  const json = await response.json();

  const rows: ResourceRow[] = [];

  if (json?.AbstractURL && json?.AbstractText) {
    rows.push({
      module_slug: slugify(moduleTitle),
      module_title: moduleTitle,
      resource_type: "web",
      title: json.Heading || moduleTitle,
      url: json.AbstractURL,
      source: "duckduckgo-abstract",
      score: scoreResource(moduleTitle, keywords, json.Heading || moduleTitle, json.AbstractURL),
    });
  }

  const related = Array.isArray(json?.RelatedTopics) ? json.RelatedTopics : [];
  for (const entry of related) {
    const topic = entry?.FirstURL ? entry : null;
    if (!topic?.FirstURL || !topic?.Text) continue;

    rows.push({
      module_slug: slugify(moduleTitle),
      module_title: moduleTitle,
      resource_type: "web",
      title: topic.Text.split(" - ")[0] || topic.Text,
      url: topic.FirstURL,
      source: "duckduckgo-related",
      score: scoreResource(moduleTitle, keywords, topic.Text, topic.FirstURL),
    });
  }

  return rows;
}

function dedupeAndRank(rows: ResourceRow[]) {
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
    .slice(0, 8);
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

  return await structured.invoke([
    {
      role: "system",
      content:
        "You are a strict curriculum structuring engine. Return only valid structured JSON matching schema. Build a practical course outline from the provided first pages of syllabus/outline text.",
    },
    {
      role: "user",
      content: `Create a compact course outline from this text:\n\n${previewText}`,
    },
  ]);
}

export async function generateOutlineAndResources(previewText: string) {
  if (!previewText?.trim()) {
    throw new Error("Preview text is empty for outline generation.");
  }

  const outline = await buildOutlineFromText(previewText);

  const webRows: ResourceRow[] = [];
  const youtubeRows: ResourceRow[] = [];
  const youtubeProvider = createYouTubeProvider();

  for (const unit of outline.modules) {
    const moduleWeb = await searchWeb(unit.title, unit.keywords);
    webRows.push(...moduleWeb);

    const yt = await youtubeProvider.search(`${outline.courseTitle} ${unit.title} lecture`, 3);
    for (const video of yt) {
      youtubeRows.push({
        module_slug: slugify(unit.title),
        module_title: unit.title,
        resource_type: "youtube",
        title: video.title,
        url: video.url,
        source: "youtube-api",
        score: scoreResource(unit.title, unit.keywords, video.title, video.url),
        metadata: {
          channelTitle: video.channelTitle,
          publishedAt: video.publishedAt,
        },
      });
    }
  }

  return {
    outline,
    resources: {
      web: dedupeAndRank(webRows),
      youtube: dedupeAndRank(youtubeRows),
      youtubeStatus: process.env.YOUTUBE_API_KEY ? "enabled" : "disabled_no_api_key",
      webStatus: "enabled_duckduckgo",
    },
  };
}
