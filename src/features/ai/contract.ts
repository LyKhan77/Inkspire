export interface GenerateRequest {
  prompt: string;
  images?: string[];
  negative_prompt?: string;
  true_cfg_scale?: number;
  num_inference_steps?: number;
  resolution?: number;
}
export interface GenerateSuccess { data: [{ b64_json: string }] }
export interface GenerateFailure { error: { code: string; message: string; field?: string; outcomeUnknown: boolean } }
export const GENERATION_LIMITS = {
  promptCharacters: 2000, references: 10, bodyBytes: 32 * 1024 * 1024,
  base64Characters: 2_800_000, referenceBytes: 2 * 1024 * 1024,
  referenceSide: 2048, referencePixels: 4_194_304,
  stepsMin: 20, stepsMax: 75, cfgMin: 1, cfgMax: 3, resolution: 1024,
} as const;
