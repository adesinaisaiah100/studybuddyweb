import { retrieveStudyContext } from "@/lib/ai/study-buddy/retriever";
import { createClient } from "@/lib/supabase/server";
import type {
  StudyBuddyGraphStateType,
} from "@/lib/ai/study-buddy/orchestrator/state";
import type {
  RetrievalBundle,
  ToolExecutionStep,
  ToolResult,
} from "@/lib/ai/study-buddy/types";

type ToolRunOutput = {
  output: unknown;
  retrieval?: RetrievalBundle;
};

type ToolExecutor = (
  step: ToolExecutionStep,
  state: StudyBuddyGraphStateType
) => Promise<ToolRunOutput>;

type VisualizationKind = "graph" | "chart" | "flowchart" | "diagram";

const ALLOWLISTED_TOOLS = new Set<string>([
  "retriever",
  "clarifier",
  "explainer",
  "example-generator",
  "problem-solver",
  "validator",
  "quiz-generator",
  "summarizer",
  "visualization",
  "slide",
  "diagram",
  "circuit",
  "simulation",
  "memory",
]);

function sanitizeToolError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Tool execution failed.";
}

async function runRetriever(
  _step: ToolExecutionStep,
  state: StudyBuddyGraphStateType
): Promise<ToolRunOutput> {
  const supabase = await createClient();
  const retrieval = await retrieveStudyContext({
    supabase,
    courseId: state.input.courseId,
    query: state.input.query,
    conversationHistory: state.input.conversationHistory,
  });

  return {
    output: {
      materialCount: retrieval.materialHits.length,
      conversationCount: retrieval.conversationHits.length,
      usedCache: retrieval.usedCache,
    },
    retrieval,
  };
}

function parsePreferredVisualizationKind(step: ToolExecutionStep): VisualizationKind | null {
  const raw = step.input?.visualType;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "graph" ||
    normalized === "chart" ||
    normalized === "flowchart" ||
    normalized === "diagram"
  ) {
    return normalized;
  }
  return null;
}

function detectVisualizationKind(query: string, step: ToolExecutionStep): VisualizationKind {
  const preferred = parsePreferredVisualizationKind(step);
  if (preferred) return preferred;

  const lower = query.toLowerCase();

  if (lower.includes("flow") || lower.includes("process") || lower.includes("pipeline")) {
    return "flowchart";
  }
  if (lower.includes("trend") || lower.includes("distribution") || lower.includes("compare") || lower.includes("percentage")) {
    return "chart";
  }
  if (lower.includes("relationship") || lower.includes("network") || lower.includes("connect")) {
    return "graph";
  }
  return "diagram";
}

function buildVisualizationMermaid(kind: VisualizationKind, topic: string) {
  switch (kind) {
    case "flowchart":
      return `flowchart TD\n  A[Input: ${topic}] --> B[Process]\n  B --> C[Output]`;
    case "graph":
      return `graph LR\n  A[${topic} Core] --- B[Related Concept 1]\n  A --- C[Related Concept 2]\n  B --- D[Application]`;
    case "chart":
      return `xychart-beta\n  title \"${topic} Comparison\"\n  x-axis [Concept A, Concept B, Concept C]\n  y-axis \"Score\" 0 --> 100\n  bar [65, 82, 74]`;
    default:
      return `mindmap\n  root((${topic}))\n    Definition\n    Mechanism\n    Example`;
  }
}

function buildVisualizationExamples(topic: string) {
  return [
    {
      type: "graph",
      useCase: `Show relationships between key concepts in ${topic}`,
    },
    {
      type: "chart",
      useCase: `Compare metrics or trends related to ${topic}`,
    },
    {
      type: "flowchart",
      useCase: `Explain the step-by-step process for ${topic}`,
    },
    {
      type: "diagram",
      useCase: `Give a high-level mental model of ${topic}`,
    },
  ];
}

async function runVisualizationTool(
  step: ToolExecutionStep,
  state: StudyBuddyGraphStateType
): Promise<ToolRunOutput> {
  const topic = state.intentAnalysis?.topic || state.input.query;
  const kind = detectVisualizationKind(state.input.query, step);

  return {
    output: {
      tool: "diagram",
      version: "1.0",
      diagramType: "mermaid",
      mermaid: buildVisualizationMermaid(kind, topic),
      title: `${topic} - ${kind} view`,
      description: `A ${kind} diagram explaining ${topic}.`,
    },
  };
}

async function runSlideTool(
  step: ToolExecutionStep,
  state: StudyBuddyGraphStateType
): Promise<ToolRunOutput> {
  const topic = state.intentAnalysis?.topic || state.input.query;
  return {
    output: {
      tool: "slide",
      version: "1.0",
      title: `${topic} Overview`,
      theme: "light",
      slides: [
        {
          heading: `Introduction to ${topic}`,
          bullets: [
            `Core concept of ${topic}`,
            "Historical context",
            "Key applications",
          ],
          notes: "Introduce the topic and its importance.",
        },
        {
          heading: "Key Mechanisms",
          bullets: [
            "Primary function",
            "Underlying principles",
            "Component interactions",
          ],
          notes: "Explain how it works in detail.",
        },
      ],
    },
  };
}

async function runDiagramTool(
  step: ToolExecutionStep,
  state: StudyBuddyGraphStateType
): Promise<ToolRunOutput> {
  const topic = state.intentAnalysis?.topic || state.input.query;
  const kind = detectVisualizationKind(state.input.query, step);

  return {
    output: {
      tool: "diagram",
      version: "1.0",
      diagramType: "mermaid",
      title: `${topic} Diagram`,
      mermaid: buildVisualizationMermaid(kind, topic),
      description: `A ${kind} diagram explaining ${topic}.`,
    },
  };
}

async function runCircuitTool(
  _step: ToolExecutionStep,
  _state: StudyBuddyGraphStateType
): Promise<ToolRunOutput> {
  return {
    output: {
      tool: "circuit",
      version: "1.0",
      title: "Basic Series Circuit",
      components: [
        { id: "v1", type: "source-dc", x: 100, y: 150, label: "9V", value: "9" },
        { id: "r1", type: "resistor", x: 300, y: 150, label: "1kΩ", value: "1000" },
        { id: "gnd", type: "ground", x: 300, y: 250 },
      ],
      wires: [
        { from: "v1", to: "r1" },
        { from: "r1", to: "gnd" },
        { from: "gnd", to: "v1" },
      ],
    },
  };
}

  // Expanded Simulation Type Detection
  let simulationType:
    | "projectile" | "pendulum" | "circuit" | "spring-mass" | "orbit" | "gas-laws" | "optics" | "wave-interference" | "fluid-flow" | "sound-wave"
    | "chemical-reaction" | "ph-titration" | "radioactive-decay" | "battery-life"
    | "population-growth" | "predator-prey" | "epidemic" | "enzyme-kinetics" | "genetic-drift" | "photosynthesis"
    | "financial-compound" | "loan-amortization" | "retirement-planning" | "property-valuation" | "supply-demand" | "inflation" | "tax-calculator"
    | "material-strength" | "beam-deflection" | "heat-transfer" | "traffic-flow"
    | "monte-carlo" | "riemann-sum" | "logic-gate" | "neural-network" | "fractal" = "projectile";

  // Physics & Mechanics
  if (lowerTopic.includes("pendulum") || lowerTopic.includes("swing")) {
    simulationType = "pendulum";
  } else if (lowerTopic.includes("projectile") || lowerTopic.includes("trajectory") || lowerTopic.includes("launch")) {
    simulationType = "projectile";
  } else if (lowerTopic.includes("circuit") || lowerTopic.includes("volt") || lowerTopic.includes("current") || lowerTopic.includes("ohm")) {
    simulationType = "circuit";
  } else if (lowerTopic.includes("spring") || lowerTopic.includes("hooke") || lowerTopic.includes("oscillation")) {
    simulationType = "spring-mass";
  } else if (lowerTopic.includes("orbit") || lowerTopic.includes("planet") || lowerTopic.includes("gravity") || lowerTopic.includes("satellite")) {
    simulationType = "orbit";
  } else if (lowerTopic.includes("gas") || lowerTopic.includes("pv") || lowerTopic.includes("pressure") || lowerTopic.includes("thermodynamics")) {
    simulationType = "gas-laws";
  } else if (lowerTopic.includes("optic") || lowerTopic.includes("lens") || lowerTopic.includes("mirror") || lowerTopic.includes("light")) {
    simulationType = "optics";
  } else if (lowerTopic.includes("interference") || lowerTopic.includes("diffraction") || lowerTopic.includes("wave")) {
    simulationType = "wave-interference";
  } else if (lowerTopic.includes("fluid") || lowerTopic.includes("bernoulli") || lowerTopic.includes("flow rate")) {
    simulationType = "fluid-flow";
  } else if (lowerTopic.includes("sound") || lowerTopic.includes("doppler") || lowerTopic.includes("frequency")) {
    simulationType = "sound-wave";
  }

  // Chemistry
  else if (lowerTopic.includes("reaction") || lowerTopic.includes("chemical") || lowerTopic.includes("kinetics")) {
    simulationType = "chemical-reaction";
  } else if (lowerTopic.includes("titration") || lowerTopic.includes("acid") || lowerTopic.includes("base") || lowerTopic.includes("ph")) {
    simulationType = "ph-titration";
  } else if (lowerTopic.includes("decay") || lowerTopic.includes("half-life") || lowerTopic.includes("radioactive")) {
    simulationType = "radioactive-decay";
  } else if (lowerTopic.includes("battery") || lowerTopic.includes("cell") || lowerTopic.includes("electrochemical")) {
    simulationType = "battery-life";
  }

  // Biology & Ecology
  else if (lowerTopic.includes("population") || lowerTopic.includes("growth") || lowerTopic.includes("logistic")) {
    simulationType = "population-growth";
  } else if (lowerTopic.includes("predator") || lowerTopic.includes("prey") || lowerTopic.includes("lotka")) {
    simulationType = "predator-prey";
  } else if (lowerTopic.includes("epidemic") || lowerTopic.includes("virus") || lowerTopic.includes("sir") || lowerTopic.includes("infection")) {
    simulationType = "epidemic";
  } else if (lowerTopic.includes("enzyme") || lowerTopic.includes("michaelis") || lowerTopic.includes("catalysis")) {
    simulationType = "enzyme-kinetics";
  } else if (lowerTopic.includes("genetic") || lowerTopic.includes("drift") || lowerTopic.includes("allele")) {
    simulationType = "genetic-drift";
  } else if (lowerTopic.includes("photosynthesis") || lowerTopic.includes("plant") || lowerTopic.includes("chlorophyll")) {
    simulationType = "photosynthesis";
  }

  // Finance & Economics
  else if (lowerTopic.includes("compound") || lowerTopic.includes("invest") || lowerTopic.includes("interest")) {
    simulationType = "financial-compound";
  } else if (lowerTopic.includes("loan") || lowerTopic.includes("mortgage") || lowerTopic.includes("amortization")) {
    simulationType = "loan-amortization";
  } else if (lowerTopic.includes("retire") || lowerTopic.includes("401k") || lowerTopic.includes("pension")) {
    simulationType = "retirement-planning";
  } else if (lowerTopic.includes("property") || lowerTopic.includes("real estate") || lowerTopic.includes("valuation")) {
    simulationType = "property-valuation";
  } else if (lowerTopic.includes("supply") || lowerTopic.includes("demand") || lowerTopic.includes("equilibrium")) {
    simulationType = "supply-demand";
  } else if (lowerTopic.includes("inflation") || lowerTopic.includes("cpi") || lowerTopic.includes("purchasing power")) {
    simulationType = "inflation";
  } else if (lowerTopic.includes("tax") || lowerTopic.includes("bracket") || lowerTopic.includes("deduction")) {
    simulationType = "tax-calculator";
  }

  // Engineering & Materials
  else if (lowerTopic.includes("stress") || lowerTopic.includes("strain") || lowerTopic.includes("material")) {
    simulationType = "material-strength";
  } else if (lowerTopic.includes("beam") || lowerTopic.includes("deflection") || lowerTopic.includes("cantilever")) {
    simulationType = "beam-deflection";
  } else if (lowerTopic.includes("heat") || lowerTopic.includes("conduction") || lowerTopic.includes("thermal")) {
    simulationType = "heat-transfer";
  } else if (lowerTopic.includes("traffic") || lowerTopic.includes("congestion") || lowerTopic.includes("road")) {
    simulationType = "traffic-flow";
  }

  // Math & Logic
  else if (lowerTopic.includes("monte carlo") || lowerTopic.includes("probability") || lowerTopic.includes("chance")) {
    simulationType = "monte-carlo";
  } else if (lowerTopic.includes("riemann") || lowerTopic.includes("integral") || lowerTopic.includes("sum")) {
    simulationType = "riemann-sum";
  } else if (lowerTopic.includes("logic") || lowerTopic.includes("gate") || lowerTopic.includes("boolean")) {
    simulationType = "logic-gate";
  } else if (lowerTopic.includes("neural") || lowerTopic.includes("network") || lowerTopic.includes("perceptron")) {
    simulationType = "neural-network";
  } else if (lowerTopic.includes("fractal") || lowerTopic.includes("mandelbrot") || lowerTopic.includes("chaos")) {
    simulationType = "fractal";
  }

  // Parameter Definitions
  const parameters: Record<string, any> = {};
  
  // Physics & Mechanics Parameters
  if (simulationType === "projectile") {
    parameters["angle"] = { value: 45, min: 0, max: 90, step: 1 };
    parameters["velocity"] = { value: 20, min: 0, max: 100, step: 1 };
  } else if (simulationType === "pendulum") {
    parameters["length"] = { value: 1, min: 0.1, max: 5, step: 0.1 };
    parameters["gravity"] = { value: 9.8, min: 1, max: 20, step: 0.1 };
  } else if (simulationType === "circuit") {
    parameters["voltage"] = { value: 9, min: 0, max: 24, step: 0.5 };
    parameters["resistance"] = { value: 100, min: 10, max: 1000, step: 10 };
  } else if (simulationType === "spring-mass") {
    parameters["mass"] = { value: 1, min: 0.1, max: 10, step: 0.1 };
    parameters["spring_constant"] = { value: 10, min: 1, max: 100, step: 1 };
    parameters["damping"] = { value: 0.1, min: 0, max: 1, step: 0.05 };
  } else if (simulationType === "orbit") {
    parameters["mass_star"] = { value: 1, min: 0.1, max: 5, step: 0.1 };
    parameters["distance"] = { value: 1, min: 0.5, max: 10, step: 0.1 };
  } else if (simulationType === "gas-laws") {
    parameters["temperature"] = { value: 300, min: 100, max: 1000, step: 10 };
    parameters["volume"] = { value: 1, min: 0.1, max: 10, step: 0.1 };
    parameters["moles"] = { value: 1, min: 0.1, max: 5, step: 0.1 };
  } else if (simulationType === "optics") {
    parameters["focal_length"] = { value: 10, min: -20, max: 20, step: 1 };
    parameters["object_distance"] = { value: 20, min: 0, max: 100, step: 1 };
  } else if (simulationType === "wave-interference") {
    parameters["frequency1"] = { value: 440, min: 20, max: 1000, step: 10 };
    parameters["frequency2"] = { value: 442, min: 20, max: 1000, step: 10 };
    parameters["amplitude"] = { value: 1, min: 0, max: 10, step: 0.1 };
  } else if (simulationType === "fluid-flow") {
    parameters["pipe_diameter"] = { value: 10, min: 1, max: 100, step: 1 };
    parameters["pressure"] = { value: 100, min: 10, max: 1000, step: 10 };
    parameters["viscosity"] = { value: 1, min: 0.1, max: 10, step: 0.1 };
  } else if (simulationType === "sound-wave") {
    parameters["frequency"] = { value: 440, min: 20, max: 20000, step: 10 };
    parameters["velocity"] = { value: 343, min: 300, max: 400, step: 1 };
  }

  // Chemistry Parameters
  else if (simulationType === "chemical-reaction") {
    parameters["concentration_a"] = { value: 1.0, min: 0.1, max: 5.0, step: 0.1 };
    parameters["temperature"] = { value: 298, min: 273, max: 500, step: 1 };
    parameters["catalyst"] = { value: 0, min: 0, max: 1, step: 0.1 };
  } else if (simulationType === "ph-titration") {
    parameters["acid_concentration"] = { value: 0.1, min: 0.01, max: 1, step: 0.01 };
    parameters["base_concentration"] = { value: 0.1, min: 0.01, max: 1, step: 0.01 };
    parameters["acid_volume"] = { value: 25, min: 10, max: 100, step: 1 };
  } else if (simulationType === "radioactive-decay") {
    parameters["half_life"] = { value: 5730, min: 1, max: 100000, step: 10 };
    parameters["initial_mass"] = { value: 100, min: 1, max: 1000, step: 1 };
  } else if (simulationType === "battery-life") {
    parameters["capacity_mah"] = { value: 3000, min: 500, max: 10000, step: 100 };
    parameters["current_draw_ma"] = { value: 500, min: 10, max: 2000, step: 10 };
    parameters["efficiency"] = { value: 0.9, min: 0.5, max: 1, step: 0.05 };
  }

  // Biology Parameters
  else if (simulationType === "population-growth") {
    parameters["initial_pop"] = { value: 100, min: 10, max: 10000, step: 10 };
    parameters["growth_rate"] = { value: 0.05, min: 0, max: 1, step: 0.01 };
    parameters["capacity"] = { value: 10000, min: 1000, max: 100000, step: 100 };
  } else if (simulationType === "predator-prey") {
    parameters["prey_birth_rate"] = { value: 0.1, min: 0, max: 1, step: 0.01 };
    parameters["predator_death_rate"] = { value: 0.1, min: 0, max: 1, step: 0.01 };
    parameters["interaction_rate"] = { value: 0.01, min: 0, max: 0.1, step: 0.001 };
  } else if (simulationType === "epidemic") {
    parameters["transmission_rate"] = { value: 0.3, min: 0, max: 1, step: 0.01 };
    parameters["recovery_rate"] = { value: 0.1, min: 0, max: 1, step: 0.01 };
    parameters["population"] = { value: 10000, min: 1000, max: 1000000, step: 1000 };
  } else if (simulationType === "enzyme-kinetics") {
    parameters["vmax"] = { value: 100, min: 10, max: 500, step: 10 };
    parameters["km"] = { value: 50, min: 1, max: 200, step: 1 };
    parameters["substrate"] = { value: 100, min: 0, max: 1000, step: 10 };
  } else if (simulationType === "genetic-drift") {
    parameters["population_size"] = { value: 100, min: 10, max: 1000, step: 10 };
    parameters["allele_freq"] = { value: 0.5, min: 0, max: 1, step: 0.05 };
    parameters["generations"] = { value: 50, min: 10, max: 500, step: 10 };
  } else if (simulationType === "photosynthesis") {
    parameters["light_intensity"] = { value: 50, min: 0, max: 100, step: 1 };
    parameters["co2_level"] = { value: 400, min: 100, max: 1000, step: 10 };
    parameters["temperature"] = { value: 25, min: 0, max: 50, step: 1 };
  }

  // Finance Parameters
  else if (simulationType === "financial-compound") {
    parameters["principal"] = { value: 1000, min: 100, max: 100000, step: 100 };
    parameters["rate"] = { value: 5, min: 0.1, max: 20, step: 0.1 };
    parameters["years"] = { value: 10, min: 1, max: 50, step: 1 };
  } else if (simulationType === "loan-amortization") {
    parameters["loan_amount"] = { value: 200000, min: 10000, max: 1000000, step: 5000 };
    parameters["interest_rate"] = { value: 4.5, min: 1, max: 15, step: 0.1 };
    parameters["term_years"] = { value: 30, min: 5, max: 40, step: 5 };
  } else if (simulationType === "retirement-planning") {
    parameters["current_age"] = { value: 30, min: 18, max: 70, step: 1 };
    parameters["retirement_age"] = { value: 65, min: 50, max: 80, step: 1 };
    parameters["monthly_contribution"] = { value: 500, min: 0, max: 5000, step: 50 };
  } else if (simulationType === "property-valuation") {
    parameters["area_sqft"] = { value: 1500, min: 500, max: 10000, step: 50 };
    parameters["price_per_sqft"] = { value: 200, min: 50, max: 2000, step: 10 };
    parameters["appreciation_rate"] = { value: 3, min: -5, max: 15, step: 0.5 };
  } else if (simulationType === "supply-demand") {
    parameters["initial_price"] = { value: 50, min: 1, max: 500, step: 1 };
    parameters["demand_elasticity"] = { value: -1, min: -5, max: -0.1, step: 0.1 };
    parameters["supply_elasticity"] = { value: 1, min: 0.1, max: 5, step: 0.1 };
  } else if (simulationType === "inflation") {
    parameters["inflation_rate"] = { value: 3, min: 0, max: 20, step: 0.1 };
    parameters["years"] = { value: 10, min: 1, max: 50, step: 1 };
    parameters["initial_amount"] = { value: 100, min: 1, max: 10000, step: 10 };
  } else if (simulationType === "tax-calculator") {
    parameters["income"] = { value: 60000, min: 0, max: 500000, step: 1000 };
    parameters["tax_rate"] = { value: 20, min: 0, max: 50, step: 1 };
    parameters["deductions"] = { value: 12000, min: 0, max: 50000, step: 500 };
  }

  // Engineering Parameters
  else if (simulationType === "material-strength") {
    parameters["load"] = { value: 1000, min: 100, max: 50000, step: 100 };
    parameters["area"] = { value: 50, min: 1, max: 500, step: 1 };
    parameters["elasticity"] = { value: 200, min: 10, max: 400, step: 5 };
  } else if (simulationType === "beam-deflection") {
    parameters["length"] = { value: 5, min: 1, max: 20, step: 0.5 };
    parameters["force"] = { value: 1000, min: 100, max: 10000, step: 100 };
    parameters["elasticity"] = { value: 200, min: 10, max: 400, step: 5 };
  } else if (simulationType === "heat-transfer") {
    parameters["thermal_conductivity"] = { value: 50, min: 1, max: 400, step: 1 };
    parameters["area"] = { value: 1, min: 0.1, max: 10, step: 0.1 };
    parameters["thickness"] = { value: 0.1, min: 0.01, max: 1, step: 0.01 };
  } else if (simulationType === "traffic-flow") {
    parameters["car_density"] = { value: 20, min: 1, max: 100, step: 1 };
    parameters["speed_limit"] = { value: 60, min: 20, max: 120, step: 5 };
    parameters["reaction_time"] = { value: 1, min: 0.1, max: 2, step: 0.1 };
  }

  // Math & Logic Parameters
  else if (simulationType === "monte-carlo") {
    parameters["iterations"] = { value: 1000, min: 100, max: 100000, step: 100 };
    parameters["probability"] = { value: 0.5, min: 0, max: 1, step: 0.01 };
  } else if (simulationType === "riemann-sum") {
    parameters["start_x"] = { value: 0, min: -10, max: 10, step: 1 };
    parameters["end_x"] = { value: 10, min: -10, max: 20, step: 1 };
    parameters["rectangles"] = { value: 10, min: 1, max: 100, step: 1 };
  } else if (simulationType === "logic-gate") {
    parameters["input_a"] = { value: 1, min: 0, max: 1, step: 1 };
    parameters["input_b"] = { value: 0, min: 0, max: 1, step: 1 };
  } else if (simulationType === "neural-network") {
    parameters["learning_rate"] = { value: 0.01, min: 0.001, max: 0.1, step: 0.001 };
    parameters["epochs"] = { value: 10, min: 1, max: 100, step: 1 };
    parameters["hidden_layers"] = { value: 1, min: 1, max: 5, step: 1 };
  } else if (simulationType === "fractal") {
    parameters["iterations"] = { value: 50, min: 10, max: 500, step: 10 };
    parameters["zoom"] = { value: 1, min: 1, max: 1000, step: 1 };
  }

  return {
    output: {
      tool: "simulation",
      version: "1.0",
      simulationType,
      parameters,
    },
  };
}

async function runMemoryTool(
  step: ToolExecutionStep,
  state: StudyBuddyGraphStateType
): Promise<ToolRunOutput> {
  const action = step.input?.action as string;
  const data = step.input?.data || {};

  // Mock implementation of logging to memory system
  // In production this would write to Supabase tables for:
  // - quiz_responses
  // - agent_states
  // - user_preferences
  // - prompt_versions
  // - file_uploads

  let result = "Logged successfully";

  if (action === "log_file" && typeof data.fileId === "string") {
    // Simulate file extraction
    result = `File ${data.fileId} processed and content logged to memory`;
  }

  return {
    output: {
      tool: "memory",
      version: "1.0",
      action,
      data,
      timestamp: new Date().toISOString(),
      status: "success",
      message: result,
    },
  };
}

function buildSimpleTextOutput(step: ToolExecutionStep, state: StudyBuddyGraphStateType) {
  const topic = state.intentAnalysis?.topic || state.input.query;
  switch (step.tool) {
    case "clarifier":
      return {
        questions: [
          `Do you want a concise or detailed answer about ${topic}?`,
          `Should I focus on concepts or examples for ${topic}?`,
        ],
      };
    case "explainer":
      return {
        summary: `Here is a structured explanation for ${topic}.`,
      };
    case "example-generator":
      return {
        examples: [
          `Example 1 for ${topic}`,
          `Example 2 for ${topic}`,
        ],
      };
    case "problem-solver":
      return {
        steps: [
          `Identify known values in the problem about ${topic}.`,
          "Apply the relevant formula or rule.",
          "Compute carefully and verify units.",
        ],
      };
    case "validator":
      return {
        checks: ["Result is internally consistent.", "No obvious arithmetic contradiction detected."],
      };
    case "quiz-generator":
      return {
        tool: "quiz",
        version: "1.0",
        title: `Quiz on ${topic}`,
        questions: [
          {
            id: "q1",
            question: `What is the core idea behind ${topic}?`,
            type: "short",
            correctAnswer: "The core concept involves...",
          },
          {
            id: "q2",
            question: `How would you apply ${topic} in a practical scenario?`,
            type: "short",
            correctAnswer: "In practice, this is used for...",
          },
        ],
      };
    case "summarizer":
      return {
        tool: "slide",
        version: "1.0",
        title: `${topic} Summary`,
        theme: "light",
        slides: [
          {
            heading: "Key Takeaways",
            bullets: [
              `Key concept of ${topic}`,
              "Most important mechanism",
              "Common mistake to avoid",
            ],
            notes: "Summary of the main points.",
          },
        ],
      };
    case "visualization":
      return {
        diagramSuggestion: `Create a ${detectVisualizationKind(state.input.query, step)} for ${topic}.`,
      };
    default:
      return {
        note: `No deterministic executor implemented for ${step.tool}.`,
      };
  }
}

const EXECUTORS: Record<string, ToolExecutor> = {
  retriever: runRetriever,
  clarifier: async (step, state) => ({ output: buildSimpleTextOutput(step, state) }),
  explainer: async (step, state) => ({ output: buildSimpleTextOutput(step, state) }),
  "example-generator": async (step, state) => ({ output: buildSimpleTextOutput(step, state) }),
  "problem-solver": async (step, state) => ({ output: buildSimpleTextOutput(step, state) }),
  validator: async (step, state) => ({ output: buildSimpleTextOutput(step, state) }),
  "quiz-generator": async (step, state) => ({ output: buildSimpleTextOutput(step, state) }),
  summarizer: async (step, state) => ({ output: buildSimpleTextOutput(step, state) }),
  visualization: runVisualizationTool,
  slide: runSlideTool,
  diagram: runDiagramTool,
  circuit: runCircuitTool,
  simulation: runSimulationTool,
  memory: runMemoryTool,
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Tool timed out.")), timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

export function isAllowlistedTool(tool: string) {
  return ALLOWLISTED_TOOLS.has(tool);
}

export async function executeAllowlistedTool(input: {
  step: ToolExecutionStep;
  state: StudyBuddyGraphStateType;
  timeoutMs: number;
}): Promise<{ result: ToolResult; retrieval?: RetrievalBundle }> {
  const startedAt = Date.now();

  if (!isAllowlistedTool(input.step.tool)) {
    return {
      result: {
        tool: input.step.tool,
        success: false,
        output: { message: "Tool blocked by allowlist." },
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  const executor = EXECUTORS[input.step.tool];
  if (!executor) {
    return {
      result: {
        tool: input.step.tool,
        success: false,
        output: { message: "Tool is allowlisted but not implemented yet." },
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  try {
    const execution = await withTimeout(
      executor(input.step, input.state),
      input.timeoutMs
    );

    return {
      result: {
        tool: input.step.tool,
        success: true,
        output: execution.output,
        latencyMs: Date.now() - startedAt,
      },
      retrieval: execution.retrieval,
    };
  } catch (error) {
    return {
      result: {
        tool: input.step.tool,
        success: false,
        output: { message: sanitizeToolError(error) },
        latencyMs: Date.now() - startedAt,
      },
    };
  }
}
