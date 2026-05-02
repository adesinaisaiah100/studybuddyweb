import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type StimulationPayload = {
    stimulationBluePrint: string;
    generatedCode: string;
  userId?: string;
}



export async function saveStimulationToDB(payload: StimulationPayload) {
    // Use Node.js-compatible Supabase client when in server/CLI context
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        `Missing Supabase environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.\n` +
        `Check your .env.local file or pass via --env-file flag.`
      );
    }

    // Create Supabase client for Node.js context (CLI scripts, server actions, etc.)
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const userId = payload.userId?.trim() || process.env.DEV_USER_ID?.trim();

    if (!userId) {
      throw new Error(
        `A userId is required to save stimulation in the current temporary setup.\n` +
        `Pass payload.userId or set DEV_USER_ID in .env.`
      );
    }

    const { stimulationBluePrint, generatedCode } = payload;
    const normalizedStimulationBluePrint = (stimulationBluePrint ?? "").trim();
    const normalizedCode = (generatedCode ??  "").trim();

    let blueprintObj: unknown;
    try {
      blueprintObj = JSON.parse(normalizedStimulationBluePrint);
    } catch (err) {
      
     console.log("Failed to parse stimulationBluePrint as JSON", err )
      try {
        const normalizedQuotes = normalizedStimulationBluePrint.replace(/\'/g, '"');
        blueprintObj = JSON.parse(normalizedQuotes);
      } catch (err2) {
        if (err2 instanceof SyntaxError) throw new Error("stimulationBluePrint is not valid JSON", err2);
      }
    }

    // Extract concept_name and simulation_type from blueprint if available
    const blueprintData = blueprintObj as Record<string, unknown> | null;
    const conceptName = blueprintData?.concept_name || "Untitled Simulation";
    const simulationType = blueprintData?.simulation_type || "unknown";

    const { data, error } = await supabase
      .rpc("save_simulation", {
        p_user_id: userId,
        p_concept_name: conceptName,
        p_simulation_type: simulationType,
        p_blueprint: blueprintObj,
        p_generated_code: normalizedCode,
      });

    if (error) throw new Error("Failed to save stimulation: " + (error.message ?? JSON.stringify(error)));

    return data;
}

