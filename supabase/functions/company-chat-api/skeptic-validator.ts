// Skeptic Validator - Post-processing validation for AI responses
// Runs AFTER the main response is generated to validate quality

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL_FLASH = 'gemini-2.0-flash';

export interface SkepticVerdict {
  verdict: 'PASS' | 'FAIL';
  confidence: number;
  issues: string[];
  suggestions: string[];
  reasoning: string;
}

export interface ValidationResult {
  validated: boolean;
  verdict: SkepticVerdict | null;
  error?: string;
}

/**
 * Validates an AI-generated response for accuracy and quality
 * This runs as a non-blocking post-process - failures don't affect the main response
 */
export async function validateResponse(
  originalQuery: string,
  aiResponse: string,
  toolResults: unknown[],
  companyContext: { symbol: string; name: string }
): Promise<ValidationResult> {
  // Skip validation for short responses or simple queries
  if (aiResponse.length < 200 || isSimpleQuery(originalQuery)) {
    return { validated: false, verdict: null };
  }

  try {
    const systemPrompt = buildSkepticPrompt(companyContext, originalQuery, aiResponse, toolResults);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_FLASH}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: 'Please validate this analysis and provide your verdict in JSON format.' }]
          }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!response.ok) {
      console.error('Skeptic API error:', response.status);
      return { validated: false, verdict: null, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const textParts = data.candidates?.[0]?.content?.parts?.filter((p: { text?: string }) => p.text) || [];
    const rawResponse = textParts.map((p: { text: string }) => p.text).join('');

    // Parse the JSON response
    const verdict = parseSkepticResponse(rawResponse);
    
    return { validated: true, verdict };
  } catch (error) {
    console.error('Skeptic validation error:', error);
    return { 
      validated: false, 
      verdict: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

function isSimpleQuery(query: string): boolean {
  const simplePatterns = [
    /^(hi|hello|hey|thanks|thank you)/i,
    /^what (can|do) you/i,
    /^how (are|do) you/i,
    /^(yes|no|ok|okay|sure)$/i
  ];
  return simplePatterns.some(p => p.test(query.trim()));
}

function buildSkepticPrompt(
  company: { symbol: string; name: string },
  query: string,
  response: string,
  toolResults: unknown[]
): string {
  const toolSummary = toolResults.length > 0 
    ? `\n\nTool Results Used:\n${JSON.stringify(toolResults, null, 2).slice(0, 2000)}`
    : '';

  return `You are a senior financial analyst reviewing AI-generated analysis for ${company.name} (${company.symbol}).

Your role is to validate the quality and accuracy of the analysis. Check for:

1. **Mathematical Accuracy**: Are calculations correct? Do numbers add up?
2. **Logical Consistency**: Does the reasoning flow logically? Are conclusions supported by data?
3. **Data Accuracy**: Do the cited figures match the tool results provided?
4. **Completeness**: Does the response adequately address the user's question?
5. **Hallucination Detection**: Are there claims not supported by the provided data?

USER QUERY:
${query}

AI RESPONSE TO VALIDATE:
${response}
${toolSummary}

Respond with a JSON object containing:
{
  "verdict": "PASS" or "FAIL",
  "confidence": 0-100,
  "issues": ["list of specific issues found"],
  "suggestions": ["list of improvements"],
  "reasoning": "brief explanation of your verdict"
}

Be strict but fair. Minor formatting issues should not cause a FAIL.
A FAIL verdict should only be given for significant accuracy or logical problems.`;
}

function parseSkepticResponse(raw: string): SkepticVerdict {
  try {
    // Try to parse as JSON directly
    const parsed = JSON.parse(raw);
    return {
      verdict: parsed.verdict === 'PASS' ? 'PASS' : 'FAIL',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 80,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      reasoning: parsed.reasoning || 'No reasoning provided'
    };
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return {
          verdict: parsed.verdict === 'PASS' ? 'PASS' : 'FAIL',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 80,
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          reasoning: parsed.reasoning || 'No reasoning provided'
        };
      } catch {
        // Fall through to default
      }
    }
    
    // Default to PASS if we can't parse
    return {
      verdict: 'PASS',
      confidence: 50,
      issues: ['Could not parse skeptic response'],
      suggestions: [],
      reasoning: 'Defaulting to PASS due to parse error'
    };
  }
}
