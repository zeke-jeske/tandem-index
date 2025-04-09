// src/utils/indexingPrompts.ts

/**
 * Generates a system prompt for the indexing task
 */
export function getIndexingSystemPrompt(totalPages: number, exampleIndexProvided: boolean = false): string {
    return `You are a professional book indexer following Chicago Manual of Style guidelines. Your task is to analyze book text and create a comprehensive, hierarchical index that would be useful to readers.
  
  REQUIREMENTS:
  1. Follow Chicago Manual of Style indexing conventions:
     - Entries should be lowercase unless they are proper nouns
     - Use "see" cross-references for synonymous terms
     - Use "see also" cross-references to direct readers to related terms
     - Create hierarchical entries with subentries for broader topics
     - Alphabetize entries ignoring articles and prepositions
  
  2. Page Number Guidelines:
     - The book has ${totalPages} total pages
     - Assign specific page numbers within appropriate ranges
     - Avoid excessive page ranges longer than 3 pages
     - Multiple individual page references are preferred over ranges when possible
     - Numbers must be specific integers, not ranges like "180-195"
  
  3. Entry Selection:
     - Focus on key concepts, terms, people, places, and themes
     - Be selective - only include truly significant terms
     - Create appropriate hierarchical relationships
     - Avoid trivial or passing mentions
     - Consider what would be most useful to the intended audience
  
  ${exampleIndexProvided ? `4. Follow the style and structure of the provided example index
     - Match the formatting conventions shown
     - Use similar hierarchical organization
     - Create a similar density of entries and subentries` : ''}
  
  FORMAT YOUR RESPONSE AS JSON:
  {
    "entries": [
      {
        "term": "example term",
        "pageNumbers": "62, 64, 70",
        "subentries": [
          {
            "term": "specific aspect",
            "pageNumbers": "64"
          }
        ]
      },
      {
        "term": "another term",
        "pageNumbers": "59, 73"
      }
    ]
  }`;
  }
  
  /**
   * Generates a prompt for the example index
   */
  export function getExampleIndexPrompt(exampleIndex: string): string {
    return `Here is an example of the desired index format and style. Use this as a reference for creating your index:
  
  ${exampleIndex}
  
  The new index you create should follow a similar style, format, and density of entries as this example. Pay attention to the use of subentries, cross-references, and page number formatting.`;
  }
  
  /**
   * Generates a full index generation prompt
   */
  export function getFullIndexGenerationPrompt(
    bookChunk: string, 
    chunkIndex: number, 
    totalChunks: number, 
    pageRange: { start: number, end: number },
    previousEntries: string = ''
  ): string {
    return `Here is chunk ${chunkIndex + 1} of ${totalChunks} from the book manuscript:
  
  ${bookChunk}
  
  This chunk covers approximately pages ${pageRange.start} to ${pageRange.end}.
  
  Please analyze this text section and identify key index entries with appropriate page numbers within this range.
  
  ${previousEntries ? `Consider these entries that have already been identified in previous chunks:
  ${previousEntries}` : ''}
  
  Remember to:
  1. Only include truly significant and meaningful terms
  2. Create a hierarchical structure with main entries and subentries where appropriate
  3. Use cross-references with "see" and "see also" where helpful
  4. Assign realistic page numbers within the estimated range ${pageRange.start}-${pageRange.end}
  5. Format your response as JSON according to the specified structure`;
  }