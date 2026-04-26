const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }
  return String(error);
}

export async function fetchRAGSearchResults(
  prompt: string,
  courseId: string,
  topK: number,
  cookieHeader?: string,
) {
  try {
    const norMalizedPrompt = prompt.trim().toLowerCase();
    const norMalizedCourseId = courseId.trim().toLowerCase();

    const response = await fetch(`${BASE_URL}/api/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        courseId: norMalizedCourseId,
        prompt: norMalizedPrompt,
        topK: topK,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error("[RAGSearchError] /api/search request failed", {
        status: response.status,
        statusText: response.statusText,
        courseId: norMalizedCourseId,
        prompt: norMalizedPrompt,
        responseBody: responseText,
      });
      throw new Error(`Search API failed with ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];

    console.log("[RAGSearchDebug] /api/search success", {
      requestId: data.requestId,
      courseId: norMalizedCourseId,
      topK,
      resultsCount: results.length,
      responseKeys: Object.keys(data),
    });

    if (results.length === 0) {
      return "";
    }

    const serializedResults = results
      .map((result: { content?: string; score?: number }, index: number) => {
        const score =
          typeof result.score === "number" ? result.score.toFixed(4) : "n/a";
        return `[Chunk ${index + 1} | score ${score}]\n${result.content ?? ""}`;
      })
      .join("\n\n---\n\n");

    return serializedResults;
  } catch (error) {
    console.error("[RAGSearchError] fetchRAGSearchResults threw", {
      courseId,
      prompt,
      topK,
      error: formatError(error),
    });
    throw error;
  }
}

//courseIDFORTEL334 - 258b72ba-cc83-492c-9223-560a8f0f61be
