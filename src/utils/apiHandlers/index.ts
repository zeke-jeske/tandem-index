// src/utils/apiHandlers.ts
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import {
  getFirstPassSystemPrompt,
  getFirstPassUserPrompt,
  getSecondPassSystemPrompt,
  getSecondPassUserPrompt,
  validateAndFixFormatting,
} from './indexingPrompts'

// Initialize the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export interface FirstPassRequest {
  chunk: string
  chunkIndex: number
  totalChunks: number
  totalPages: number
  previousEntries?: IndexEntry[]
  exampleIndex?: string
  audienceLevel?: string
  indexDensity?: string
  targetAudience?: string
  specialInstructions?: string
}

export interface SecondPassRequest {
  allEntries: IndexEntry[]
  totalPages: number
  exampleIndex?: string
  documentSummary?: string
  audienceLevel?: string
  indexDensity?: string
  targetAudience?: string
  specialInstructions?: string
}

/**
 * Handles first pass index generation for a document chunk
 */
export async function handleFirstPass(
  request: FirstPassRequest,
): Promise<NextResponse> {
  const {
    chunk,
    chunkIndex,
    totalChunks,
    totalPages,
    previousEntries = [],
    exampleIndex = '',
    audienceLevel = 'undergraduate',
    indexDensity = 'medium',
    targetAudience = '',
    specialInstructions = '',
  } = request

  // Validation
  if (!chunk || typeof chunk !== 'string') {
    return NextResponse.json(
      { error: 'Invalid document chunk provided' },
      { status: 400 },
    )
  }

  // Calculate the approximate page range for this chunk
  const pagesPerChunk = totalPages / totalChunks
  const startPage = Math.max(1, Math.floor(chunkIndex * pagesPerChunk))
  const endPage = Math.min(
    totalPages,
    Math.floor((chunkIndex + 1) * pagesPerChunk),
  )

  console.log(
    `Processing chunk ${chunkIndex + 1}/${totalChunks} (pages ~${startPage}-${endPage}) with length ${chunk.length}`,
  )

  const systemPrompt = getFirstPassSystemPrompt({
    totalPages,
    exampleIndex,
    previousEntries,
    audienceLevel,
    indexDensity,
    targetAudience,
    specialInstructions,
  })

  try {
    const fullResponse = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 15000,
      thinking: {
        type: 'enabled',
        budget_tokens: 8000,
      },
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: getFirstPassUserPrompt(startPage, endPage, chunk),
        },
      ],
    })

    // Extract thinking content and response text
    let thinkingContent = ''
    let responseText = ''

    if (Array.isArray(fullResponse.content)) {
      for (const contentBlock of fullResponse.content) {
        if (contentBlock.type === 'thinking') {
          thinkingContent = contentBlock.thinking
          console.log(
            `🧠 Claude's thinking process for chunk ${chunkIndex + 1}:`,
            thinkingContent,
          )
        } else if (contentBlock.type === 'text') {
          responseText = contentBlock.text
        }
      }
    }

    if (!responseText) {
      console.error('No text content in Claude response:', fullResponse)
      throw new Error('No text content received from Claude API')
    }

    console.log('Extracted text content:', responseText)

    // Parse JSON response
    const parsedEntries = parseIndexResponse(responseText, startPage, endPage)

    return NextResponse.json({
      success: true,
      entries: parsedEntries,
    })
  } catch (apiError) {
    console.error('Claude API error details:', apiError)
    return NextResponse.json(
      {
        success: false,
        error:
          apiError instanceof Error ? apiError.message : 'Unknown API error',
        details: JSON.stringify(apiError),
      },
      { status: 500 },
    )
  }
}

/**
 * Handles second pass index refinement
 */
export async function handleSecondPass(
  request: SecondPassRequest,
): Promise<NextResponse> {
  const {
    allEntries,
    totalPages,
    exampleIndex = '',
    documentSummary = '',
    audienceLevel = 'undergraduate',
    indexDensity = 'medium',
    targetAudience = '',
    specialInstructions = '',
  } = request

  // Validation
  if (!allEntries || !Array.isArray(allEntries) || allEntries.length === 0) {
    return NextResponse.json(
      { error: 'Invalid or empty entries provided for refinement' },
      { status: 400 },
    )
  }

  if (!totalPages || typeof totalPages !== 'number' || totalPages <= 0) {
    return NextResponse.json(
      { error: 'Valid document page count is required' },
      { status: 400 },
    )
  }

  console.log(
    `Starting second pass refinement for ${allEntries.length} entries in a ${totalPages}-page document`,
  )

  const systemPrompt = getSecondPassSystemPrompt({
    totalPages,
    audienceLevel,
    indexDensity,
    targetAudience,
    specialInstructions,
  })

  try {
    console.log('Making refinement API call...')

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 12000, // Reduced to prevent overly verbose responses
      thinking: {
        type: 'enabled',
        budget_tokens: 8000, // Reduced thinking budget to focus on essentials
      },
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: getSecondPassUserPrompt({
            totalPages,
            allEntries,
            documentSummary,
            exampleIndex,
          }),
        },
      ],
    })

    // Extract thinking content and response text
    let thinkingContent = ''
    let responseText = ''

    if (Array.isArray(response.content)) {
      for (const contentBlock of response.content) {
        if (contentBlock.type === 'thinking') {
          thinkingContent = contentBlock.thinking
          console.log(
            `🧠 Claude's thinking process for second pass refinement:`,
            thinkingContent,
          )
        } else if (contentBlock.type === 'text') {
          responseText = contentBlock.text
        }
      }
    }

    if (!responseText) {
      console.error('No text content in Claude response:', response)
      throw new Error('No text content received from Claude API')
    }

    console.log('Received refinement response of length:', responseText.length)

    // Parse and validate refined response
    const refinedEntries = parseRefinedResponse(responseText, allEntries)

    return NextResponse.json({
      success: true,
      entries: refinedEntries,
    })
  } catch (apiError) {
    console.error('Claude API error during refinement:', apiError)

    // Return the original entries with a warning
    return NextResponse.json({
      success: true,
      warning: 'API error during refinement, using original entries',
      entries: allEntries,
    })
  }
}

/**
 * Parses JSON response from first pass and validates entries
 */
function parseIndexResponse(
  responseText: string,
  startPage: number,
  endPage: number,
): IndexEntry[] {
  try {
    let indexEntries: { entries: IndexEntry[] } = { entries: [] }

    // Try to extract JSON content
    if (responseText.includes('```json')) {
      let jsonText = responseText.split('```json')[1].split('```')[0].trim()
      const parsed = JSON.parse(jsonText)

      // Handle different response formats
      let entries: any[] = []
      if (Array.isArray(parsed)) {
        entries = parsed
      } else if (parsed && typeof parsed === 'object') {
        entries =
          parsed.entries || parsed.index_entries || parsed.indexEntries || []
      }

      // Standardize the entries format
      indexEntries.entries = entries.map((item: any) => ({
        term: item.term || 'unknown term',
        pageNumbers:
          item.pageNumbers ||
          item.page_numbers ||
          (item.pages ? String(item.pages) : `${startPage}-${endPage}`),
        subentries: item.subentries || [],
      }))
    } else {
      // Try to parse the whole response as JSON
      try {
        const parsed = JSON.parse(responseText)
        if (parsed.entries) {
          indexEntries = parsed
        }
      } catch (e) {
        console.log('Response is not JSON')
      }
    }

    // Filter out invalid entries
    indexEntries.entries = indexEntries.entries.filter(
      (entry) =>
        entry &&
        entry.term &&
        entry.term !== 'undefined' &&
        entry.term !== 'unknown term',
    )

    // Apply Chicago Manual validation
    indexEntries.entries = validateAndFixFormatting(indexEntries.entries)

    console.log(`Parsed ${indexEntries.entries?.length || 0} index entries`)

    return indexEntries.entries
  } catch (parseError) {
    console.error('Failed to parse response:', parseError)
    // Return fallback entries
    return [
      { term: 'indexing', pageNumbers: `${startPage}` },
      { term: 'book content', pageNumbers: `${startPage}-${endPage}` },
    ]
  }
}

/**
 * Parses and validates the refined response from second pass
 */
function parseRefinedResponse(
  responseText: string,
  fallbackEntries: IndexEntry[],
): IndexEntry[] {
  try {
    // Check if response is too large (likely too verbose)
    if (responseText.length > 80000) {
      // ~80KB limit
      console.warn(
        `Response is very large (${responseText.length} chars), may contain excess verbosity`,
      )
    }

    // Clean the response text to extract just the JSON
    let jsonText = responseText.trim()

    // Remove any text before the JSON starts
    const jsonStartMatch = jsonText.match(/\{[\s\S]*"entries"\s*:\s*\[/)
    if (jsonStartMatch) {
      const startIndex = jsonText.indexOf(jsonStartMatch[0])
      jsonText = jsonText.substring(startIndex)
    }

    // Remove any text after the JSON ends - find the last complete closing brace
    let braceCount = 0
    let lastValidIndex = -1
    for (let i = 0; i < jsonText.length; i++) {
      if (jsonText[i] === '{') braceCount++
      else if (jsonText[i] === '}') {
        braceCount--
        if (braceCount === 0) {
          lastValidIndex = i
          break
        }
      }
    }

    if (lastValidIndex > -1) {
      jsonText = jsonText.substring(0, lastValidIndex + 1)
    }

    // Remove any markdown code block markers
    if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/```json?/g, '').replace(/```/g, '')
    }

    console.log(`Attempting to parse ${jsonText.length} characters of JSON...`)

    const refinedData = JSON.parse(jsonText)

    if (!refinedData.entries || !Array.isArray(refinedData.entries)) {
      console.error('Invalid refined entries structure:', refinedData)
      throw new Error('Refined entries missing or not in expected format')
    }

    console.log(
      `Successfully parsed ${refinedData.entries.length} refined entries`,
    )

    // Filter out any entries with undefined or empty terms
    const filteredEntries = refinedData.entries.filter(
      (entry: any) =>
        entry &&
        entry.term &&
        entry.term.trim() !== '' &&
        entry.term.toLowerCase() !== 'undefined' &&
        entry.term.toLowerCase() !== 'unknown term',
    )

    // Validate and fix formatting according to Chicago Manual of Style
    const validatedEntries = validateAndFixFormatting(filteredEntries)

    // Sort entries alphabetically (case-insensitive)
    validatedEntries.sort((a: any, b: any) => {
      if (!a.term) return 1 // Move undefined terms to the end
      if (!b.term) return -1 // Move undefined terms to the end
      return a.term.toLowerCase().localeCompare(b.term.toLowerCase())
    })

    // For each entry, sort its subentries (case-insensitive)
    validatedEntries.forEach((entry: any) => {
      if (entry.subentries && entry.subentries.length > 0) {
        entry.subentries.sort((a: any, b: any) =>
          a.term.toLowerCase().localeCompare(b.term.toLowerCase()),
        )
      }
    })

    return validatedEntries
  } catch (parseError) {
    console.error('Failed to parse refined response:', parseError)
    console.error(
      'Response text preview:',
      responseText.substring(0, 1000) + '...',
    )

    // Return the original entries with a warning
    return fallbackEntries
  }
}
