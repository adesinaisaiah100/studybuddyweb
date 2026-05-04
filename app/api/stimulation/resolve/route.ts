import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stimulationGenerationSubAgent } from "@/lib/studyagent/stimulationSubAgent";
import { findMatchingSimulationByTargetVariables } from "@/lib/studyagent/stimulationlookupTool";

type StimulationResolveBody = {
  contextSnippet?: string;
  targetVariables?: string[];
  conceptName?: string;
};

export type StimulationResolveResponse = {
  success: boolean;
  source: "lookup" | "generated" | null;
  generatedCode: string | null;
  error?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as StimulationResolveBody;
    const contextSnippet = String(body.contextSnippet ?? "").trim();
    const conceptName = body.conceptName?.trim();
    const targetVariables = Array.isArray(body.targetVariables)
      ? body.targetVariables.map((value) => String(value ?? "").trim()).filter(Boolean)
      : [];

    if (!contextSnippet || targetVariables.length === 0) {
      return NextResponse.json<StimulationResolveResponse>(
        {
          success: false,
          source: null,
          generatedCode: null,
          error: "contextSnippet and non-empty targetVariables are required.",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json<StimulationResolveResponse>(
        {
          success: false,
          source: null,
          generatedCode: null,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const cached = await findMatchingSimulationByTargetVariables(
      targetVariables,
      conceptName,
    );

    if (cached?.generatedCode) {
      return NextResponse.json<StimulationResolveResponse>({
        success: true,
        source: "lookup",
        generatedCode: cached.generatedCode,
      });
    }

    const generatedCode = await stimulationGenerationSubAgent({
      context_snippet: contextSnippet,
      target_variables: targetVariables,
    });

    if (!generatedCode || !String(generatedCode).trim()) {
      return NextResponse.json<StimulationResolveResponse>(
        {
          success: false,
          source: null,
          generatedCode: null,
          error: "Generation completed with empty code.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json<StimulationResolveResponse>({
      success: true,
      source: "generated",
      generatedCode: String(generatedCode),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resolve failed.";

    return NextResponse.json<StimulationResolveResponse>(
      {
        success: false,
        source: null,
        generatedCode: null,
        error: message,
      },
      { status: 500 },
    );
  }
}
