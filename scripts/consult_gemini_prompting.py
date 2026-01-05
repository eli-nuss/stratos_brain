"""
Consult Gemini 3 Pro Preview for better prompting strategies to make
direction score and quality score more independent.
"""

import os
import json
from openai import OpenAI

# Use OpenAI-compatible API with Gemini
client = OpenAI()

CURRENT_PROMPT_EXCERPT = """
Current JSON output structure includes:
- "direction": "bullish" or "bearish" or "neutral"
- "ai_direction_score": integer from -100 to +100 (directional conviction)
- "ai_setup_quality_score": integer from 0 to 100 (setup quality)
- "setup_type": "breakout" or "reversal" or "continuation" or "range"
- "attention_level": "URGENT" or "FOCUS" or "WATCH" or "IGNORE"
- "confidence": float from 0.0 to 1.0
- "subscores": trend_structure, momentum_alignment, volatility_regime, volume_confirmation, risk_reward_clarity (each 0-5)
"""

PROBLEM_DESCRIPTION = """
We have an AI-powered trading signal system that analyzes cryptocurrency charts.
The system currently outputs two key scores:

1. **Direction Score** (-100 to +100): How bullish or bearish the AI thinks the asset is
2. **Quality Score** (0 to 100): How clean/tradeable the technical setup is

THE PROBLEM:
Our analysis shows these scores are highly correlated (0.65-0.68 correlation).
The AI is essentially saying "bullish = good setup" and "bearish = bad setup".

Only 1 out of 328 bearish assets has a quality score > 80.

This defeats the purpose of having two separate scores. We want:
- A bearish asset with a clean breakdown pattern to have HIGH quality
- A bullish asset with a messy chart to have LOW quality
- The scores should be more independent (correlation closer to 0)

CURRENT SUBSCORES (each 0-5):
- trend_structure
- momentum_alignment  
- volatility_regime
- volume_confirmation
- risk_reward_clarity

These subscores are currently summed to create the quality score, but they seem
to be influenced by the directional bias.
"""

CONSULTATION_PROMPT = f"""You are an expert in prompt engineering for financial AI systems.

{PROBLEM_DESCRIPTION}

{CURRENT_PROMPT_EXCERPT}

Please help me redesign the prompting and scoring system to make direction and quality truly independent. Specifically:

1. **Redefine Quality Score**: What should "quality" actually measure that is direction-agnostic? Give me a clear definition and criteria.

2. **New Subscores**: Should we change the subscores? What subscores would better capture direction-independent quality?

3. **Prompt Engineering**: How should I phrase the prompt to make the AI evaluate quality separately from direction? Give me specific language.

4. **Explicit Instructions**: What explicit instructions should I add to prevent the AI from conflating direction with quality?

5. **Example Scenarios**: Give me 2-3 example scenarios where:
   - Asset is bearish but has HIGH quality (clean short setup)
   - Asset is bullish but has LOW quality (messy chart)

Please provide concrete, actionable recommendations I can implement in my prompt.
"""

def main():
    print("Consulting Gemini 3 Pro Preview for better prompting strategies...\n")
    print("=" * 80)
    
    response = client.chat.completions.create(
        model="gemini-2.5-flash",  # Using available model
        messages=[
            {"role": "user", "content": CONSULTATION_PROMPT}
        ],
        temperature=0.7,
        max_tokens=4096
    )
    
    result = response.choices[0].message.content
    print(result)
    print("\n" + "=" * 80)
    
    # Save the response
    with open("/home/ubuntu/stratos_brain/docs/prompting_recommendations.md", "w") as f:
        f.write("# Gemini Recommendations for Improving AI Analysis Prompting\n\n")
        f.write(result)
    
    print("\nSaved recommendations to docs/prompting_recommendations.md")

if __name__ == "__main__":
    main()
