// Shared Anthropic client + model config for the intelligence layer.
// The API key is read from ANTHROPIC_API_KEY by the SDK's default resolver.
// dotenv is loaded by the entrypoints (warm.ts / server index.ts), not here,
// so this module stays pure and testable.
import Anthropic from '@anthropic-ai/sdk';

// CONTRACTS §3 / TECH_DESIGN §5: default claude-sonnet-5, override via INTEL_MODEL.
// Fallback confirmed valid by the claude-api skill: claude-opus-4-8.
export const FALLBACK_MODEL = 'claude-opus-4-8';

export function getModel(): string {
  return process.env.INTEL_MODEL?.trim() || 'claude-sonnet-5';
}

let _client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!_client) _client = new Anthropic(); // resolves ANTHROPIC_API_KEY from env
  return _client;
}

// Minimal usage accumulator shape we surface for reporting.
export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export function addUsage(
  a: Usage,
  b:
    | {
        input_tokens?: number | null;
        output_tokens?: number | null;
        cache_read_input_tokens?: number | null;
        cache_creation_input_tokens?: number | null;
      }
    | undefined,
): Usage {
  if (!b) return a;
  return {
    input_tokens: a.input_tokens + (b.input_tokens ?? 0),
    output_tokens: a.output_tokens + (b.output_tokens ?? 0),
    cache_read_input_tokens: (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens: (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0),
  };
}

export const zeroUsage = (): Usage => ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
