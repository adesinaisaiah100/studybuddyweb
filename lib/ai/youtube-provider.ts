export type YouTubeResource = {
  title: string;
  url: string;
  channelTitle: string;
  publishedAt?: string;
};

export interface YouTubeProvider {
  search(query: string, maxResults: number): Promise<YouTubeResource[]>;
}

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
};

type YouTubeCandidate = {
  title?: string;
  url: string;
  channelTitle: string;
  publishedAt?: string;
};

function isYouTubeResource(candidate: YouTubeCandidate): candidate is YouTubeResource {
  return Boolean(candidate.title && candidate.url);
}

class YouTubeApiProvider implements YouTubeProvider {
  async search(query: string, maxResults: number): Promise<YouTubeResource[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return [];

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: String(Math.min(Math.max(maxResults, 1), 10)),
      key: apiKey,
      safeSearch: "strict",
      videoEmbeddable: "true",
      relevanceLanguage: "en",
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (!response.ok) return [];

    const json = await response.json();
    if (!Array.isArray(json.items)) return [];

    const mapped: YouTubeCandidate[] = (json.items as YouTubeSearchItem[])
      .map((item) => ({
        title: item?.snippet?.title,
        url: item?.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : "",
        channelTitle: item?.snippet?.channelTitle || "",
        publishedAt: item?.snippet?.publishedAt,
      }));

    return mapped.filter(isYouTubeResource);
  }
}

export function createYouTubeProvider(): YouTubeProvider {
  return new YouTubeApiProvider();
}
