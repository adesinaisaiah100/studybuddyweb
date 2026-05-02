import { createClient } from "@/lib/supabase/server";

export type StimulationLookupResult = {
  id: string;
  conceptName: string;
  simulationType: string | null;
  generatedCode: string;
  createdAt: string;
};

/**
 * Find a matching saved simulation for the current authenticated user by target variable signature.
 * This delegates matching to the server-side Supabase RPC for better scaling.
 */
export async function findMatchingSimulationByTargetVariables(
  targetVariables: string[],
  conceptName?: string
): Promise<StimulationLookupResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const requestedTargets = Array.isArray(targetVariables)
    ? Array.from(
        new Set(
          targetVariables
            .map((value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "))
            .filter((value) => value.length > 0)
        )
      ).sort()
    : [];

  if (requestedTargets.length === 0) {
    return null;
  }

  const { data, error } = await supabase.rpc("find_simulation_by_target_signature", {
    p_user_id: user.id,
    p_concept_name: conceptName || "",
    p_target_variables: requestedTargets,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: String(data.id),
    conceptName: String(data.concept_name ?? ""),
    simulationType: (data.simulation_type as string) ?? null,
    generatedCode: String(data.generated_code ?? ""),
    createdAt: String(data.created_at ?? ""),
  };
}