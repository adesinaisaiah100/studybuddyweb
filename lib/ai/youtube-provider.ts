export type YouTubeResource = {
  title: string;
  url: string;
  channelTitle: string;
  publishedAt?: string;
};

export interface YouTubeProvider {
  search(query: string, maxResults: number): Promise<YouTubeResource[]>;
  searchPage(
    query: string,
    maxResults: number,
    pageToken?: string
  ): Promise<{ items: YouTubeResource[]; nextPageToken?: string }>;
}

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
};

type YouTubeVideoItem = {
  id?: string;
  status?: {
    privacyStatus?: string;
    embeddable?: boolean;
  };
};

type YouTubeCandidate = {
  title?: string;
  url: string;
  channelTitle: string;
  publishedAt?: string;
};

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

function isYouTubeResource(candidate: YouTubeCandidate): candidate is YouTubeResource {
  return Boolean(candidate.title && isDirectYouTubeVideoUrl(candidate.url));
}

class YouTubeApiProvider implements YouTubeProvider {
  async search(query: string, maxResults: number): Promise<YouTubeResource[]> {
    const page = await this.searchPage(query, maxResults);
    return page.items;
  }

  async searchPage(
    query: string,
    maxResults: number,
    pageToken?: string
  ): Promise<{ items: YouTubeResource[]; nextPageToken?: string }> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return { items: [] };

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: String(Math.min(Math.max(maxResults, 1), 50)),
      key: apiKey,
      safeSearch: "strict",
      videoEmbeddable: "true",
      relevanceLanguage: "en",
      order: "relevance",
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (!response.ok) return { items: [] };

    const json = await response.json();
    if (!Array.isArray(json.items)) return { items: [] };

    const ids = (json.items as YouTubeSearchItem[])
      .map((item) => item?.id?.videoId)
      .filter((id): id is string => Boolean(id));

    let allowedIdSet: Set<string> | null = null;
    if (ids.length > 0) {
      const detailsParams = new URLSearchParams({
        part: "status",
        id: ids.join(","),
        key: apiKey,
      });

      const detailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`
      );

      if (detailsResponse.ok) {
        const detailsJson = await detailsResponse.json();
        const detailItems = Array.isArray(detailsJson?.items) ? (detailsJson.items as YouTubeVideoItem[]) : [];
        allowedIdSet = new Set(
          detailItems
            .filter((item) => item?.id)
            .filter((item) => (item.status?.privacyStatus || "") === "public")
            .filter((item) => item.status?.embeddable !== false)
            .map((item) => item.id as string)
        );
      }
    }

    const mapped: YouTubeCandidate[] = (json.items as YouTubeSearchItem[])
      .filter((item) => {
        if (!allowedIdSet) return true;
        const id = item?.id?.videoId;
        return Boolean(id && allowedIdSet.has(id));
      })
      .map((item) => ({
        title: item?.snippet?.title,
        url: item?.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : "",
        channelTitle: item?.snippet?.channelTitle || "",
        publishedAt: item?.snippet?.publishedAt,
      }));

    return {
      items: mapped.filter(isYouTubeResource),
      nextPageToken: typeof json?.nextPageToken === "string" ? json.nextPageToken : undefined,
    };
  }
}

export function createYouTubeProvider(): YouTubeProvider {
  return new YouTubeApiProvider();
}
