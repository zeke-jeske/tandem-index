// src/utils/indexingPrompts.ts

interface IndexEntry {
  term: string
  pageNumbers: string
  subentries?: {
    term: string
    pageNumbers: string
  }[]
}

/**
 * Validates and fixes index entries according to Chicago Manual of Style guidelines
 */
export function validateAndFixFormatting(entries: IndexEntry[]): IndexEntry[] {
  return entries.map((entry) => {
    // If entry has subentries, main entry should have no page numbers
    if (entry.subentries && entry.subentries.length > 0) {
      entry.pageNumbers = ''

      // Enforce maximum 15 subentries per entry
      if (entry.subentries.length > 15) {
        console.warn(
          `Entry "${entry.term}" has ${entry.subentries.length} subentries, trimming to 15`,
        )
        entry.subentries = entry.subentries.slice(0, 15)
      }
    }

    // Format page ranges for main entry
    if (entry.pageNumbers) {
      entry.pageNumbers = formatPageRanges(entry.pageNumbers)
    }

    // Format page ranges for subentries
    if (entry.subentries) {
      entry.subentries = entry.subentries.map((subentry) => ({
        ...subentry,
        pageNumbers: formatPageRanges(subentry.pageNumbers),
      }))

      // Sort subentries alphabetically (case-insensitive)
      entry.subentries.sort((a, b) =>
        a.term.toLowerCase().localeCompare(b.term.toLowerCase()),
      )
    }

    return entry
  })
}

/**
 * Formats page numbers according to Chicago Manual of Style guidelines
 * Converts "45, 46, 47, 48" to "45-48" and handles inclusive numbering rules
 */
export function formatPageRanges(pageStr: string): string {
  if (!pageStr || pageStr.trim() === '') return pageStr

  // Split by commas and extract individual pages
  const parts = pageStr.split(',').map((part) => part.trim())
  const pages: number[] = []
  const nonNumeric: string[] = []

  // Separate numeric pages from cross-references
  parts.forEach((part) => {
    if (part.toLowerCase().includes('see')) {
      nonNumeric.push(part)
    } else {
      const num = parseInt(part, 10)
      if (!isNaN(num)) {
        pages.push(num)
      } else {
        nonNumeric.push(part)
      }
    }
  })

  if (pages.length === 0) return pageStr

  // Sort pages
  pages.sort((a, b) => a - b)

  // Group consecutive pages into ranges
  const ranges: string[] = []
  let rangeStart = pages[0]
  let rangeEnd = pages[0]

  for (let i = 1; i < pages.length; i++) {
    if (pages[i] === rangeEnd + 1) {
      // Consecutive page - extend the current range
      rangeEnd = pages[i]
    } else {
      // Non-consecutive - finalize the current range
      ranges.push(formatSingleRange(rangeStart, rangeEnd))
      rangeStart = pages[i]
      rangeEnd = pages[i]
    }
  }

  // Add the final range
  ranges.push(formatSingleRange(rangeStart, rangeEnd))

  // Combine with non-numeric parts
  const allParts = [...ranges, ...nonNumeric]
  return allParts.join(', ')
}

/**
 * Formats a single page range according to Chicago Manual of Style inclusive numbering
 */
function formatSingleRange(start: number, end: number): string {
  if (start === end) {
    return start.toString()
  }

  // Chicago Manual of Style inclusive numbering rules:
  if (start < 100 && end < 100) {
    // Less than 100: include all digits (36-37)
    return `${start}-${end}`
  } else if (start >= 101 && start <= 109 && end >= 101 && end <= 109) {
    // 101-109: only include changed part (107-9)
    return `${start}-${end.toString().slice(-1)}`
  } else if (start >= 110 && start < 200 && end >= 110 && end < 200) {
    // 110-199: include two digits (115-16)
    return `${start}-${end.toString().slice(-2)}`
  } else {
    // For larger numbers or cross-century ranges, include all digits
    return `${start}-${end}`
  }
}

/**
 * Generates the system prompt for the first pass of indexing
 */
export function getFirstPassSystemPrompt({
  totalPages,
  exampleIndex = '',
  previousEntries = [],
  audienceLevel = 'undergraduate',
  indexDensity = 'medium',
  targetAudience = '',
  specialInstructions = '',
}: {
  totalPages: number
  exampleIndex?: string
  previousEntries?: IndexEntry[]
  audienceLevel?: string
  indexDensity?: string
  targetAudience?: string
  specialInstructions?: string
}): string {
  return `You are an expert book indexer. Create index terms following Chicago Manual of Style guidelines.

INDEXING PRINCIPLES:
• Index substantive discussions of concepts, not just mentions
• Focus on aspects not readily visible in headings - be a guide to hidden content
• Index body text only, not endorsements, dedications, table of contents, acknowledgments, or bibliographies
• Focus on nouns that readers would look up (avoid adjectives/adverbs)
• Target ${Math.round(totalPages * 0.7)} main entries for this ${totalPages}-page document
• Don't index passing references unless they're significant to the book's themes

STRUCTURE:
• Use only two levels: primary entry and one level of subentries underneath
• Maximum 15 subentries per main entry (split into multiple related entries if more needed)
• Entries WITH subentries: NO page numbers on main entry
• Entries WITHOUT subentries: include page numbers on main entry  
• Don't capitalize unless proper nouns capitalized in the body text
• Use "See" for synonymous terms, "See also" for related terms
• Format cross-references: "term. See preferred term" or "term, pages. See also related term"

${exampleIndex ? `STYLE EXAMPLE: ${exampleIndex}` : ''}

${previousEntries.length > 0 ? `PREVIOUS ENTRIES: ${JSON.stringify(previousEntries, null, 2)}` : ''}

${specialInstructions ? `SPECIAL INSTRUCTIONS (PRIORITY): ${specialInstructions}` : ''}

Audience: ${audienceLevel} level, ${indexDensity} density. Target audience: ${targetAudience}`
}

/**
 * Generates the user prompt for the first pass of indexing
 */
export function getFirstPassUserPrompt(
  startPage: number,
  endPage: number,
  chunk: string,
): string {
  // Determine if this is full-document processing or chunk processing
  const isFullDocument = startPage === 1 && endPage > 150 // Likely full document if starts at 1 and is substantial
  const documentType = isFullDocument ? 'complete document' : 'book excerpt'
  const pageSpan = isFullDocument
    ? `the entire ${endPage}-page document`
    : `approximately pages ${startPage} to ${endPage}`

  return `Create index entries for this ${documentType} (${pageSpan}).

FOCUS ON:
• Substantive nouns that readers would look up
• Key concepts, methods, people, and places central to the book's themes
• Skip passing mentions and adjective-based terms
• Estimate page numbers based on content position

CRITICAL: Return ONLY JSON in this exact format:
{
  "entries": [
    {
      "term": "main entry with subentries",
      "pageNumbers": "",
      "subentries": [
        { "term": "subentry", "pageNumbers": "42, 67" }
      ]
    },
    {
      "term": "main entry without subentries",
      "pageNumbers": "23, 45, 78"
    }
  ]
}

DOCUMENT TO INDEX:
${chunk}`
}

/**
 * Generates the system prompt for the second pass of indexing
 */
export function getSecondPassSystemPrompt({
  totalPages,
  audienceLevel = 'undergraduate',
  indexDensity = 'medium',
  targetAudience = '',
  specialInstructions = '',
}: {
  totalPages: number
  audienceLevel?: string
  indexDensity?: string
  targetAudience?: string
  specialInstructions?: string
}): string {
  return `You are an expert book indexer. Your task is to refine a raw index into a high-quality professional index.

CORE REQUIREMENTS:
• Target ${Math.round(totalPages * 0.8)}-${Math.round(totalPages * 1.2)} main entries for this ${totalPages}-page document
• Use only two levels: primary entry and one level of subentries underneath
• Maximum 15 subentries per main entry (split into multiple related entries if more needed)
• Entries WITH subentries: NO page numbers on main entry
• Entries WITHOUT subentries: include page numbers on main entry
• Focus on substantive nouns that readers would actually look up
• Remove trivial mentions and adjective-based entries
• Focus on content not readily visible in headings - guide readers to hidden insights

FORMATTING:
• Don't capitalize unless proper nouns capitalized in the body text
• Use "See" for synonymous terms, "See also" for related terms
• Format cross-references: "term. See preferred term" or "term, pages. See also related term"
• Alphabetize everything properly

${
  specialInstructions
    ? `SPECIAL INSTRUCTIONS (PRIORITY):
${specialInstructions}`
    : ''
}

Target audience: ${audienceLevel} level, ${indexDensity} density.`
}

/**
 * Generates the user prompt for the second pass of indexing
 */
export function getSecondPassUserPrompt({
  totalPages,
  allEntries,
  documentSummary = '',
  exampleIndex = '',
}: {
  totalPages: number
  allEntries: IndexEntry[]
  documentSummary?: string
  exampleIndex?: string
}): string {
  return `Refine this raw index for a ${totalPages}-page document.

REFINEMENT GOALS:
• Create ${Math.round(totalPages * 0.8)}-${Math.round(totalPages * 1.2)} quality main entries
• Maximum 15 subentries per main entry
• Remove entries that are just passing mentions or adjectives
• Merge related concepts appropriately
• Ensure perfect alphabetical order (case-insensitive)
• NO DUPLICATE ENTRIES - merge similar terms

CRITICAL: Maintain a single unified index in perfect A-Z order. Do not create separate sections.

${
  exampleIndex
    ? `STYLE REFERENCE:
${exampleIndex}`
    : ''
}

RAW INDEX TO REFINE:
${JSON.stringify(allEntries, null, 2)}

Return ONLY JSON in this exact format:
{
  "entries": [
    {
      "term": "main entry with subentries",
      "pageNumbers": "",
      "subentries": [
        { "term": "subentry", "pageNumbers": "42, 67" }
      ]
    },
    {
      "term": "main entry without subentries", 
      "pageNumbers": "23, 45, 78"
    }
  ]
}`
}
