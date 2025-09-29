// src/utils/indexProcessing.ts
import { formatPageRanges } from '../../src/utils/apiHandlers/indexingPrompts'
import IndexEntry from '@/utils/indexEntry'

/**
 * Extracts page numbers from a string and converts them to an array of numbers and strings
 */
export function extractPageNumbers(pageStr: string): (number | string)[] {
  return pageStr
    .split(/,\s*/)
    .map((part) => {
      // Try to parse as integer
      const num = parseInt(part.trim(), 10)
      if (!isNaN(num)) return num

      // If it contains a range like "23-25", parse both numbers
      const rangeMatch = part.match(/(\d+)-(\d+)/)
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10)
        const end = parseInt(rangeMatch[2], 10)
        if (!isNaN(start) && !isNaN(end)) {
          // Return all numbers in the range
          return Array.from({ length: end - start + 1 }, (_, i) => start + i)
        }
      }

      // Otherwise keep as is (for "see also" references)
      return part.trim()
    })
    .flat()
}

/**
 * Merges index entries from different chunks, combining page numbers and maintaining alphabetical order
 */
export function mergeIndexEntries(
  existingEntries: IndexEntry[],
  newEntries: IndexEntry[],
): IndexEntry[] {
  const merged = [...existingEntries]

  newEntries.forEach((newEntry) => {
    // Check if this term already exists
    const existingIndex = merged.findIndex((e) => {
      if (!e.term || !newEntry.term) return false
      return e.term.toLowerCase() === newEntry.term.toLowerCase()
    })

    if (existingIndex >= 0) {
      // Merge page numbers for existing entry
      const existing = merged[existingIndex]
      const existingPages = extractPageNumbers(existing.pageNumbers)
      const newPages = extractPageNumbers(newEntry.pageNumbers)

      // Combine page numbers and remove duplicates
      const allPages = [...existingPages, ...newPages]
        .filter(
          (p) =>
            p &&
            (typeof p === 'number' ||
              !p.toString().toLowerCase().includes('see')),
        )
        .filter((p) => (typeof p === 'number' ? !isNaN(p) : true))
        .sort((a, b) => {
          if (typeof a === 'number' && typeof b === 'number') {
            return a - b
          }
          return String(a).localeCompare(String(b))
        })

      // Convert back to string format and format ranges
      const uniquePages = [...new Set(allPages)]
        .map((p) => String(p))
        .join(', ')

      // Handle any "see" or "see also" references
      const seeReferences = [...existingPages, ...newPages]
        .filter(
          (p) =>
            typeof p === 'string' && p.toString().toLowerCase().includes('see'),
        )
        .filter((p, i, arr) => arr.indexOf(p) === i) // Remove duplicates

      const updatedPages =
        uniquePages +
        (seeReferences.length > 0
          ? (uniquePages ? ', ' : '') + seeReferences.join(', ')
          : '')

      // Apply Chicago Manual of Style page range formatting
      merged[existingIndex].pageNumbers = formatPageRanges(updatedPages)

      // Merge subentries
      if (newEntry.subentries && newEntry.subentries.length > 0) {
        if (!existing.subentries) existing.subentries = []

        newEntry.subentries.forEach((newSubentry) => {
          const existingSubIndex = existing.subentries!.findIndex(
            (s) => s.term.toLowerCase() === newSubentry.term.toLowerCase(),
          )

          if (existingSubIndex >= 0) {
            // Merge page numbers for existing subentry
            const existingSubPages = extractPageNumbers(
              existing.subentries![existingSubIndex].pageNumbers,
            )
            const newSubPages = extractPageNumbers(newSubentry.pageNumbers)

            // Combine page numbers and remove duplicates
            const allSubPages = [...existingSubPages, ...newSubPages]
              .filter(
                (p) =>
                  p &&
                  (typeof p === 'number' ||
                    !p.toString().toLowerCase().includes('see')),
              )
              .filter((p) => (typeof p === 'number' ? !isNaN(p) : true))
              .sort((a, b) => {
                if (typeof a === 'number' && typeof b === 'number') {
                  return a - b
                }
                return String(a).localeCompare(String(b))
              })

            // Convert back to string format and format ranges
            const uniqueSubPages = [...new Set(allSubPages)]
              .map((p) => String(p))
              .join(', ')

            // Handle any "see" or "see also" references
            const seeSubReferences = [...existingSubPages, ...newSubPages]
              .filter(
                (p) =>
                  typeof p === 'string' &&
                  p.toString().toLowerCase().includes('see'),
              )
              .filter((p, i, arr) => arr.indexOf(p) === i) // Remove duplicates

            const updatedSubPages =
              uniqueSubPages +
              (seeSubReferences.length > 0
                ? (uniqueSubPages ? ', ' : '') + seeSubReferences.join(', ')
                : '')

            // Apply Chicago Manual of Style page range formatting
            existing.subentries![existingSubIndex].pageNumbers =
              formatPageRanges(updatedSubPages)
          } else {
            // Add new subentry
            existing.subentries!.push(newSubentry)
          }
        })
      }
    } else {
      // Add new entry with formatted page ranges
      const formattedEntry = {
        ...newEntry,
        pageNumbers: newEntry.pageNumbers
          ? formatPageRanges(newEntry.pageNumbers)
          : newEntry.pageNumbers,
        subentries: newEntry.subentries?.map((subentry) => ({
          ...subentry,
          pageNumbers: formatPageRanges(subentry.pageNumbers),
        })),
      }
      merged.push(formattedEntry)
    }
  })

  return merged
}

/**
 * Determines optimal processing strategy based on document size and page count
 */
export function determineProcessingStrategy(
  pageCount: number,
  textLength: number,
): boolean {
  const SINGLE_PASS_PAGE_LIMIT = 150 // Conservative for reliability
  const SINGLE_PASS_CHAR_LIMIT = 300000 // 300k chars - good balance of accuracy vs reliability

  return (
    pageCount < SINGLE_PASS_PAGE_LIMIT && textLength < SINGLE_PASS_CHAR_LIMIT
  )
}

/**
 * Calculates chunk parameters for document processing
 */
export function calculateChunkParameters(textLength: number): {
  chunkSize: number
  overlapSize: number
  totalChunks: number
} {
  const CHUNK_SIZE = 120000 // ~120K characters per chunk
  const OVERLAP_SIZE = 15000 // 15K characters overlap for context continuity

  const effectiveChunkSize = CHUNK_SIZE - OVERLAP_SIZE
  const totalChunks = Math.ceil(textLength / effectiveChunkSize)

  return {
    chunkSize: CHUNK_SIZE,
    overlapSize: OVERLAP_SIZE,
    totalChunks,
  }
}
