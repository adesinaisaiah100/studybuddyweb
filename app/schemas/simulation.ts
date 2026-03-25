import { z } from "zod";
import { BaseToolSchema } from "./base";

export const SimulationToolSchema = BaseToolSchema.extend({
  tool: z.literal("simulation"),
  simulationType: z.enum([
    // Physics & Mechanics
    "projectile",
    "pendulum",
    "circuit",
    "spring-mass",
    "orbit",
    "gas-laws",
    "optics",
    "wave-interference",
    "fluid-flow",
    "sound-wave",
    
    // Chemistry
    "chemical-reaction",
    "ph-titration",
    "radioactive-decay",
    "battery-life",
    
    // Biology & Ecology
    "population-growth",
    "predator-prey",
    "epidemic",
    "enzyme-kinetics",
    "genetic-drift",
    "photosynthesis",
    
    // Finance & Economics
    "financial-compound",
    "loan-amortization",
    "retirement-planning",
    "property-valuation",
    "supply-demand",
    "inflation",
    "tax-calculator",
    
    // Engineering & Materials
    "material-strength",
    "beam-deflection",
    "heat-transfer",
    "traffic-flow",
    
    // Math & Logic
    "monte-carlo",
    "riemann-sum",
    "logic-gate",
    "neural-network",
    "fractal",
  ]),
  parameters: z.record(
    z.string(),
    z.object({
      value: z.number(),
      min: z.number(),
      max: z.number(),
      step: z.number().optional(),
    })
  ),
});
