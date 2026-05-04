const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export type StimulationResolveApiRequest = {
  contextSnippet: string;
  targetVariables: string[];
  conceptName?: string;
};

export type StimulationResolveApiResponse = {
  success: boolean;
  source: "lookup" | "generated" | null;
  generatedCode: string | null;
  error?: string;
};

export async function resolveStimulationViaApi(
  input: StimulationResolveApiRequest,
  cookieHeader?: string,
): Promise<StimulationResolveApiResponse> {
  const normalizedTargetVariables = Array.isArray(input.targetVariables)
    ? input.targetVariables
        .map((value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "))
        .filter((value) => value.length > 0)
    : [];

  const response = await fetch(`${BASE_URL}/api/stimulation/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({
      contextSnippet: String(input.contextSnippet ?? "").trim(),
      conceptName: input.conceptName?.trim() || undefined,
      targetVariables: normalizedTargetVariables,
    }),
  });

  const payload = (await response.json()) as StimulationResolveApiResponse;

  if (!response.ok) {
    throw new Error(payload.error || "Stimulation resolve API request failed.");
  }

  return payload;
}
