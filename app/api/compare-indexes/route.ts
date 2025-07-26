import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface ComparisonRequest {
  index1: string;
  index2: string;
  index1Title: string;
  index2Title: string;
}

interface ComparisonResult {
  winner: 'index1' | 'index2' | 'tie';
  overallScore: {
    index1: number;
    index2: number;
  };
  criteria: {
    comprehensiveness: { index1: number; index2: number; explanation: string };
    accuracy: { index1: number; index2: number; explanation: string };
    organization: { index1: number; index2: number; explanation: string };
    crossReferences: { index1: number; index2: number; explanation: string };
    formatting: { index1: number; index2: number; explanation: string };
  };
  detailedAnalysis: string;
  recommendation: string;
  thinking?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ComparisonRequest = await request.json();
    const { index1, index2, index1Title, index2Title } = body;

    // Validate input
    if (!index1 || !index2) {
      return NextResponse.json(
        { error: 'Both indexes are required for comparison' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    // System prompt for professional index comparison
    const systemPrompt = `You are a professional book indexing expert with 20+ years of experience evaluating and creating indexes for academic and professional publications. You have deep knowledge of indexing standards including the Chicago Manual of Style, and you understand what makes an index truly valuable for readers.

You will compare two book indexes objectively and provide detailed analysis across multiple criteria. Focus on practical utility for readers, professional indexing standards, and overall quality.

Your analysis should be unbiased, thorough, and grounded in professional indexing expertise.`;

    const userPrompt = `Please compare these two book indexes objectively and professionally. Evaluate them across multiple criteria and provide detailed analysis.

**${index1Title}:**
\`\`\`
${index1}
\`\`\`

**${index2Title}:**
\`\`\`
${index2}
\`\`\`

Please analyze these indexes across these five key criteria (score each 1-10):

1. **Comprehensiveness**: Coverage of concepts, thoroughness, completeness
2. **Accuracy**: Correct page references, appropriate term selection
3. **Organization**: Logical structure, appropriate subentries, alphabetization
4. **Cross-references**: See-also references, conceptual connections
5. **Formatting**: Professional appearance, consistent style, readability

For each criterion, provide:
- Numerical scores for both indexes (1-10)
- Brief explanation of the scoring

Then provide:
- Overall scores (average of the 5 criteria)
- Determination of winner or tie
- Detailed analysis (2-3 paragraphs)
- Professional recommendation

Return your analysis in this exact JSON format:

\`\`\`json
{
  "winner": "index1" | "index2" | "tie",
  "overallScore": {
    "index1": <number>,
    "index2": <number>
  },
  "criteria": {
    "comprehensiveness": {
      "index1": <number>,
      "index2": <number>,
      "explanation": "<explanation>"
    },
    "accuracy": {
      "index1": <number>,
      "index2": <number>,
      "explanation": "<explanation>"
    },
    "organization": {
      "index1": <number>,
      "index2": <number>,
      "explanation": "<explanation>"
    },
    "crossReferences": {
      "index1": <number>,
      "index2": <number>,
      "explanation": "<explanation>"
    },
    "formatting": {
      "index1": <number>,
      "index2": <number>,
      "explanation": "<explanation>"
    }
  },
  "detailedAnalysis": "<2-3 paragraph analysis>",
  "recommendation": "<professional recommendation>"
}
\`\`\`

Be thorough, fair, and professional in your analysis.`;

    console.log('Sending comparison request to Claude Opus...');

    // Call Claude Opus with extended thinking
    const response = await anthropic.messages.create({
      model: "claude-opus-4-20250514", // Using Opus for highest quality analysis
      max_tokens: 20000, // Total tokens for both thinking and response
      thinking: {
        type: "enabled",
        budget_tokens: 15000 // Allow extensive thinking for thorough analysis
      },
      system: systemPrompt,
      messages: [{
        role: "user",
        content: userPrompt
      }]
    });

    console.log('Received response from Claude Opus');

    // Extract thinking content and response text
    let thinkingContent = '';
    let responseText = '';
    
    if (Array.isArray(response.content)) {
      for (const contentBlock of response.content) {
        if (contentBlock.type === 'thinking') {
          thinkingContent += contentBlock.thinking + '\n';
        } else if (contentBlock.type === 'text') {
          responseText += contentBlock.text;
        }
      }
    }

    // Log thinking process to console
    if (thinkingContent) {
      console.log('=== Claude\'s Thinking Process ===');
      console.log(thinkingContent);
      console.log('=== End Thinking Process ===');
    }

    // Parse JSON response
    let comparisonResult: ComparisonResult;
    try {
      // Extract JSON from response (it might be wrapped in markdown)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
      comparisonResult = JSON.parse(jsonStr);
      
      // Add thinking content to result if available
      if (thinkingContent) {
        comparisonResult.thinking = thinkingContent;
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError);
      console.error('Raw response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse comparison results from Claude' },
        { status: 500 }
      );
    }

    // Validate the response structure
    if (!comparisonResult.winner || !comparisonResult.overallScore || !comparisonResult.criteria) {
      console.error('Invalid response structure:', comparisonResult);
      return NextResponse.json(
        { error: 'Invalid response structure from Claude' },
        { status: 500 }
      );
    }

    console.log(`Comparison complete. Winner: ${comparisonResult.winner}`);
    console.log(`Scores: ${index1Title} = ${comparisonResult.overallScore.index1}, ${index2Title} = ${comparisonResult.overallScore.index2}`);

    return NextResponse.json(comparisonResult);

  } catch (error) {
    console.error('Error comparing indexes:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'An unexpected error occurred during comparison'
      },
      { status: 500 }
    );
  }
} 