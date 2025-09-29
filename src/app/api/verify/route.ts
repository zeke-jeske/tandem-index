// src/app/api/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Initialize the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '', // Make sure to set this in your .env.local file
})

export async function POST(request: NextRequest) {
  try {
    const { passages, fullText, documentPageCount } = await request.json()

    if (!passages || !Array.isArray(passages) || passages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid passages provided' },
        { status: 400 },
      )
    }

    if (!fullText || typeof fullText !== 'string') {
      return NextResponse.json(
        { error: 'Document text is required' },
        { status: 400 },
      )
    }

    if (
      !documentPageCount ||
      typeof documentPageCount !== 'number' ||
      documentPageCount <= 0
    ) {
      return NextResponse.json(
        { error: 'Valid document page count is required' },
        { status: 400 },
      )
    }

    console.log('Starting Claude API call with passages:', passages.length)

    // Limit document size to avoid token limits
    const trimmedText =
      fullText.length > 30000 ? fullText.substring(0, 30000) + '...' : fullText

    // Update system prompt to include page count instructions
    const systemPrompt = `You are a book indexing assistant that can identify page numbers for text passages in a document.
    Your task is to analyze the document structure and identify which page each passage appears on.
    
    This document is ${documentPageCount} pages long. Your page number estimates should be between 1 and ${documentPageCount}.
    
    For book manuscripts, you can recognize page breaks through:
    - Natural document flow and paragraph transitions
    - Chapter beginnings and endings
    - Section breaks marked by extra spacing
    - A typical book page contains approximately 250-300 words
    
    IMPORTANT: 
    - Always assign a specific page number to each passage
    - Page numbers must be integers between 1 and ${documentPageCount}
    - Distribute your page number estimates realistically across the document length
    
    Respond with EXACTLY this JSON format and nothing else:
    {
      "results": [
        {
          "passage": "[exact passage text]",
          "pageNumber": 5,
          "confidence": "high"
        },
        {
          "passage": "[exact passage text]",
          "pageNumber": 10,
          "confidence": "medium"
        },
        {
          "passage": "[exact passage text]",
          "pageNumber": 15,
          "confidence": "low"
        }
      ]
    }
    
    Do not include any explanations, notes, or additional formatting.`

    const userPrompt = `Here's the full text of a book manuscript that is exactly ${documentPageCount} pages long:

${trimmedText}

Please identify the page numbers for these passages:
${passages.map((p, i) => `${i + 1}. "${p}"`).join('\n')}

Remember this document is ${documentPageCount} pages total, so your page numbers should be between 1 and ${documentPageCount}.`

    console.log('Making API call to Claude...')

    // Modified section
    // Make the API call to Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Try this more widely available model
      system: systemPrompt,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    console.log('Raw Claude response:', JSON.stringify(response))

    // Fix for the error by properly accessing the content
    // Check the content type and extract the text accordingly
    let responseText = ''

    // Look for text content in the response
    if (Array.isArray(response.content)) {
      for (const contentBlock of response.content) {
        if (contentBlock.type === 'text') {
          responseText = contentBlock.text
          break
        }
      }
    } else {
      console.log('Unexpected response structure:', JSON.stringify(response))
      return NextResponse.json(
        { error: 'Unexpected response structure from Claude API' },
        { status: 500 },
      )
    }

    if (!responseText) {
      console.log(
        'No text content found in response:',
        JSON.stringify(response),
      )
      return NextResponse.json(
        { error: 'No text content found in Claude response' },
        { status: 500 },
      )
    }

    console.log('Claude response text:', responseText)

    // Parse Claude's response to extract the predicted page numbers
    let predictedPages

    // Update in src/app/api/verify/route.ts
    try {
      // Add a log of the raw response text for debugging
      console.log('Raw response text to parse:', responseText)

      // Try to clean up the response text before parsing
      // Sometimes Claude might add extra text before or after the JSON
      let jsonText = responseText

      // Try to extract just the JSON object
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
        console.log('Extracted JSON text:', jsonText)
      }

      // Now try to parse it
      try {
        predictedPages = JSON.parse(jsonText)
      } catch (jsonError) {
        console.error('JSON parse error. Attempting fallback parsing...')

        // Create a fallback response manually
        predictedPages = {
          results: passages.map((passage, index) => ({
            passage,
            pageNumber: index + 1, // Use a simple incremental page number as fallback
            confidence: 'low',
          })),
        }
      }

      console.log('Parsed prediction:', predictedPages)

      if (!predictedPages.results || !Array.isArray(predictedPages.results)) {
        console.error('Invalid results structure. Creating fallback structure.')
        predictedPages = {
          results: passages.map((passage, index) => ({
            passage,
            pageNumber: index + 1,
            confidence: 'low',
          })),
        }
      }

      // Ensure all results have page numbers
      interface PredictedPageResult {
        passage: string
        pageNumber: number
        confidence: 'high' | 'medium' | 'low'
      }

      interface PredictedPages {
        results: PredictedPageResult[]
      }

      predictedPages.results = predictedPages.results.map(
        (
          result: Partial<PredictedPageResult>,
          index: number,
        ): PredictedPageResult => {
          // If pageNumber is missing or not a number, set a default
          if (!result.pageNumber || typeof result.pageNumber !== 'number') {
            console.log(
              `Warning: Missing or invalid page number for result ${index}`,
            )
            return {
              ...result,
              pageNumber: index + 1, // Use index+1 as a fallback
              confidence: result.confidence || 'low',
            } as PredictedPageResult
          }
          return result as PredictedPageResult
        },
      )
    } catch (error: unknown) {
      const parseError = error as Error
      console.error('Failed to parse Claude response:', parseError)

      // Create a fallback response instead of returning an error
      const fallbackResults = passages.map((passage, index) => ({
        passage,
        pageNumber: index + 1, // Use a simple incremental page number as fallback
        confidence: 'low' as const,
      }))

      return NextResponse.json({
        success: true,
        results: fallbackResults,
        warning: `Could not parse Claude response: ${parseError.message}`,
      })
    }

    // After parsing the JSON from Claude's text response
    console.log(
      'Parsed prediction details:',
      JSON.stringify(predictedPages, null, 2),
    )

    return NextResponse.json({
      success: true,
      results: predictedPages.results,
    })
  } catch (error: unknown) {
    // Fixed: Properly type the error as unknown and then as Error
    const err = error as Error
    console.error('Verification error:', err)

    // Send more detailed error information
    return NextResponse.json(
      {
        error: 'Failed to verify passages',
        details: err.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 },
    )
  }
}
