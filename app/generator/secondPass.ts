import { IndexEntry } from 'app/generator/indexProcessing'
import { audienceLevels } from './ConfigureStep'
import { ProcessingStatus } from './IndexGenerator'

export type SecondPassReturn =
  | {
      entries: IndexEntry[]
      result: 'success'
      message?: string
    }
  | {
      result: 'failed'
      message: string
    }

function isValidResponse(
  x: any,
): x is { entries: IndexEntry[]; warning?: string } {
  return (
    x &&
    typeof x === 'object' &&
    'entries' in x &&
    Array.isArray(x.entries) &&
    (x.warning === undefined || typeof x.warning === 'string')
  )
}

/**
 * After an initial pass by the LLM, we do a second pass to refine and consolidate the entries.
 */
export default async function secondPass(
  rawEntries: IndexEntry[],
  documentSummary: string,
  abortControllerRef: React.RefObject<AbortController>,
  documentPageCount: number,
  audienceLevel: 0 | 1 | 2,
  indexDensity: 0 | 1 | 2,
  targetAudience: string,
  specialInstructions: string,
  showExampleInput: boolean,
  exampleIndex: string,
): Promise<SecondPassReturn> {
  try {
    console.log(`Starting second pass with ${rawEntries.length} raw entries...`)

    const refinementResponse = await fetch('/api/generate-index', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isSecondPass: true,
        allEntries: rawEntries,
        totalPages: documentPageCount,
        exampleIndex: showExampleInput ? exampleIndex : '',
        documentSummary,
        audienceLevel: audienceLevels[audienceLevel],
        indexDensity:
          indexDensity === 0
            ? 'broad'
            : indexDensity === 1
              ? 'medium'
              : 'detailed',
        targetAudience: targetAudience,
        specialInstructions: specialInstructions,
      }),
      signal: abortControllerRef.current.signal,
    })

    if (!refinementResponse.ok) {
      const errorData = await refinementResponse.json()
      console.error('Refinement API error:', errorData)
      throw new Error(
        typeof errorData === 'object' && errorData?.error
          ? errorData.error
          : 'Failed to refine index',
      )
    }

    const refinedData: unknown = await refinementResponse.json()

    if (!isValidResponse(refinedData)) {
      console.error('Invalid refined entries:', refinedData)
      throw new Error('Refinement did not return valid entries')
    }

    if (refinedData.warning) {
      console.warn('Refinement warning:', refinedData.warning)
    }

    console.log(`Received ${refinedData.entries.length} refined entries`)

    // Use the refined entries
    return {
      entries: refinedData.entries,
      result: 'success',
    }
  } catch (refinementError) {
    console.error('Error during refinement phase:', refinementError)

    // If we have entries from the first pass, use them as a fallback
    if (rawEntries.length > 0) {
      console.log(
        `Using ${rawEntries.length} entries from first pass due to error during second pass`,
      )

      // Filter, sort, and present the entries from the first pass
      const filteredEntries = rawEntries.filter(
        (entry) =>
          entry &&
          entry.term &&
          entry.term.trim() !== '' &&
          entry.term.toLowerCase() !== 'undefined' &&
          entry.term.toLowerCase() !== 'unknown term',
      )

      // Sort entries alphabetically
      filteredEntries.sort((a, b) => {
        if (!a.term) return 1
        if (!b.term) return -1
        return a.term.localeCompare(b.term)
      })

      // For each entry, sort its subentries
      filteredEntries.forEach((entry) => {
        if (entry.subentries && entry.subentries.length > 0) {
          entry.subentries.sort((a, b) => a.term.localeCompare(b.term))
        }
      })

      return {
        entries: filteredEntries,
        result: 'success',
        message: `Completed with first pass results only. Refinement error: ${refinementError instanceof Error ? refinementError.message : 'An unexpected error occurred'}`,
      }
    } else {
      // If we don't have any entries, show an error
      return {
        result: 'failed',
        message:
          refinementError instanceof Error
            ? refinementError.message
            : 'An unexpected error occurred during index refinement',
      }
    }
  }
}
