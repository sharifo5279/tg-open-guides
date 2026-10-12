/**
 * One interface over whichever model key is present.
 *
 * Kept deliberately thin. The compiler calls complete() and does not know or care
 * which provider answered, so moving this to Vertex-hosted Gemini inside the
 * OpenText trust boundary is a configuration change rather than a rewrite.
 */

import { jsonrepair } from 'jsonrepair';

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

export function modelAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
}

export function modelName() {
  if (process.env.ANTHROPIC_API_KEY) return `anthropic:${ANTHROPIC_MODEL}`;
  if (process.env.GEMINI_API_KEY) return `gemini:${GEMINI_MODEL}`;
  return 'structural-fallback';
}

async function completeAnthropic({ system, prompt, maxTokens }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }]
  });
  if (res.stop_reason === 'max_tokens') console.warn(`[model] output reached max_tokens (${maxTokens}); the response is truncated`);
  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

async function completeGemini({ system, prompt, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0 }
    })
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  return (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
}

export async function complete({ system, prompt, maxTokens = 8000 }) {
  if (process.env.ANTHROPIC_API_KEY) return completeAnthropic({ system, prompt, maxTokens });
  if (process.env.GEMINI_API_KEY) return completeGemini({ system, prompt, maxTokens });
  throw new Error('No model key configured');
}

/** Models wrap JSON in prose and fences no matter how firmly you ask them not to. */
export function parseJsonLoose(text) {
  if (!text) throw new Error('empty model response');
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.search(/[[{]/);
  if (start > 0) s = s.slice(start);
  const lastBrace = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lastBrace !== -1 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1);
  try {
    return JSON.parse(s);
  } catch (err) {
    /* Guide text is full of quoted codes ("ST", "00"), and the model sometimes
       leaves one unescaped inside a string. Repair before giving up the chunk. */
    console.warn(`[model] invalid JSON (${err.message.slice(0, 80)}); repairing`);
    return JSON.parse(jsonrepair(s));
  }
}
