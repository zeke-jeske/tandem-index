// src/utils/indexingPrompts.ts

interface IndexEntry {
  term: string;
  pageNumbers: string;
  subentries?: {
    term: string;
    pageNumbers: string;
  }[];
}

/**
 * Validates and fixes index entries according to Chicago Manual of Style guidelines
 */
export function validateAndFixFormatting(entries: IndexEntry[]): IndexEntry[] {
  return entries.map(entry => {
    // If entry has subentries, main entry should have no page numbers
    if (entry.subentries && entry.subentries.length > 0) entry.pageNumbers = "";
    
    // Format page ranges for main entry
    if (entry.pageNumbers) {
      entry.pageNumbers = formatPageRanges(entry.pageNumbers);
    }
    
    // Format page ranges for subentries
    if (entry.subentries) {
      entry.subentries = entry.subentries.map(subentry => ({
        ...subentry,
        pageNumbers: formatPageRanges(subentry.pageNumbers)
      }));
    }
    
    return entry;
  });
}

/**
 * Formats page numbers according to Chicago Manual of Style guidelines
 * Converts "45, 46, 47, 48" to "45-48" and handles inclusive numbering rules
 */
export function formatPageRanges(pageStr: string): string {
  if (!pageStr || pageStr.trim() === '') return pageStr;
  
  // Split by commas and extract individual pages
  const parts = pageStr.split(',').map(part => part.trim());
  const pages: number[] = [];
  const nonNumeric: string[] = [];
  
  // Separate numeric pages from cross-references
  parts.forEach(part => {
    if (part.toLowerCase().includes('see')) {
      nonNumeric.push(part);
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        pages.push(num);
      } else {
        nonNumeric.push(part);
      }
    }
  });
  
  if (pages.length === 0) return pageStr;
  
  // Sort pages
  pages.sort((a, b) => a - b);
  
  // Group consecutive pages into ranges
  const ranges: string[] = [];
  let rangeStart = pages[0];
  let rangeEnd = pages[0];
  
  for (let i = 1; i < pages.length; i++) {
    if (pages[i] === rangeEnd + 1) {
      // Consecutive page - extend the current range
      rangeEnd = pages[i];
    } else {
      // Non-consecutive - finalize the current range
      ranges.push(formatSingleRange(rangeStart, rangeEnd));
      rangeStart = pages[i];
      rangeEnd = pages[i];
    }
  }
  
  // Add the final range
  ranges.push(formatSingleRange(rangeStart, rangeEnd));
  
  // Combine with non-numeric parts
  const allParts = [...ranges, ...nonNumeric];
  return allParts.join(', ');
}

/**
 * Formats a single page range according to Chicago Manual of Style inclusive numbering
 */
function formatSingleRange(start: number, end: number): string {
  if (start === end) {
    return start.toString();
  }
  
  // Chicago Manual of Style inclusive numbering rules:
  if (start < 100 && end < 100) {
    // Less than 100: include all digits (36-37)
    return `${start}-${end}`;
  } else if (start >= 101 && start <= 109 && end >= 101 && end <= 109) {
    // 101-109: only include changed part (107-9)
    return `${start}-${end.toString().slice(-1)}`;
  } else if (start >= 110 && start < 200 && end >= 110 && end < 200) {
    // 110-199: include two digits (115-16)
    return `${start}-${end.toString().slice(-2)}`;
  } else {
    // For larger numbers or cross-century ranges, include all digits
    return `${start}-${end}`;
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
  targetAudience = ''
}: {
  totalPages: number;
  exampleIndex?: string;
  previousEntries?: IndexEntry[];
  audienceLevel?: string;
  indexDensity?: string;
  targetAudience?: string;
}): string {
  return `You are an expert book indexer for academic books following Chicago Manual of Style guidelines. 
  You are analyzing a chunk of text to identify potential index terms. Use your deep knowledge of Chicago
  Standards, and you can also rely on the shortened guidelines below. 

  ## CHICAGO MANUAL OF STYLE INDEXING GUIDELINES ##
  
  CONTENT SELECTION:
  • Focus on the book's emphases; do not index people, events, or places mentioned only in passing, 
      as this will make the index too broad and not useful for the book's audience.
  • Any reader can find information in headings. You should aim to be a guide, pointing out aspects
      that are not readily visible on first glance.
  • Index the body of the text only, not endorsements, dedication, table of contents, 
     acknowledgments, or bibliographies. Readers won't be looking for this information in the index.
  • Do not index footnotes unless they contribute significantly to the discussion.
  • Key entries should be nouns, not adjectives or adverbs (e.g., avoid "diverse" - it leaves readers wondering "diverse what?")
  • Target approximately ${Math.round(totalPages*0.7)} main entries for this ${totalPages}-page document.
     This will create a balanced index so that readers don't get overwhelmed, but still have necessary info.
  
  STRUCTURE AND HIERARCHY:
  • Use only two levels of entries—the primary entry and one level of subentry underneath
  • Limit subentries to maximum 20 per main entry (ideally keep much lower, 5-15 subentries)
      Otherwise, the reader must spend time searching through long lists of subentries.
  • In the same vein, if a term would require more than 20 subentries, split it into 
     multiple related entries.
  • Entries without subentries should include page numbers
  • Subentries may be descriptive words or phrases about the key entry 
  
  FORMAT:
  • Do not capitalize index entries unless they are proper nouns capitalized in the body text
  • For inclusive numbers: less than 100 include all digits (36-37), 101-109 only include changed part (107-9), 110-199 include two digits (115-16)
  • Avoid using f. or ff. in an index
  • For names, spell out first name rather than using initials unless person is known by initials
  • Avoid indexing people mentioned only by first name or for illustration purposes
  • Use word-by-word alphabetizing system
  • Articles, prepositions, conjunctions are not used for alphabetizing if at beginning of subentry
  
  CROSS-REFERENCES:
  • Use "See" cross-references for synonymous terms or preferred terminology
  • Use "See also" cross-references to direct readers to related terms
  • Format: "term, page numbers. See also related term"

  ${exampleIndex ? `## EXAMPLE INDEX ##
    Please follow the style and formatting of this example index:
    ${exampleIndex}` : ''}
    
    ${previousEntries.length > 0 ? `## PREVIOUS ENTRIES ##
    These entries have been identified in previous sections of the document:
    ${JSON.stringify(previousEntries, null, 2)}
    
    Consider these entries when creating new ones to maintain consistency.` : ''}

  ## AUDIENCE INFORMATION ##
  Audience Level: ${audienceLevel}
  Index Density: ${indexDensity}
  Target Audience: ${targetAudience}

  Adjust your indexing approach based on these parameters. For ${audienceLevel} audiences, focus on ${
    audienceLevel === "high_school" ? "more basic concepts and clearer terminology" : 
    audienceLevel === "undergraduate" ? "foundational concepts with some specialized terminology" : 
    "advanced concepts and specialized terminology"
  }.

  For ${indexDensity} index density, create a ${
    indexDensity === "broad" ? "more concise index with fewer general entries" : 
    indexDensity === "medium" ? "balanced index with moderate detail" : 
    "highly detailed index with specific subentries"
  }.`;
}

/**
 * Generates the user prompt for the first pass of indexing
 */
export function getFirstPassUserPrompt(startPage: number, endPage: number, chunk: string): string {
  // Determine if this is full-document processing or chunk processing
  const isFullDocument = startPage === 1 && endPage > 150; // Likely full document if starts at 1 and is substantial
  const documentType = isFullDocument ? 'complete document' : 'book excerpt';
  const pageSpan = isFullDocument 
    ? `the entire ${endPage}-page document` 
    : `approximately pages ${startPage} to ${endPage}`;
  
  return `Create a professional index for this ${documentType}. Go above and beyond to make the index 
  as comprehensive and relevant as possible for the book's audience.
  ${isFullDocument ? `This is ${pageSpan}, giving you complete context for optimal indexing decisions.` : `The excerpt spans ${pageSpan}.`}

  ## TASK ##
  For this FIRST PASS, focus on:
  1. Identifying index-worthy NOUNS (concepts, people, places, themes) - avoid adjectives and adverbs
  2. Focus on book's emphases - skip people, events, or places mentioned only in passing
  3. Include terms that represent substantive discussions, not just word occurrences
  4. ${isFullDocument 
      ? 'With complete document context, create accurate page number estimates based on content flow and structure' 
      : 'Include specific page numbers based on your estimate of where content appears in this chunk'}
  5. Create hierarchical structure for broader terms (limit subentries to max 20, ideally 5-15)
  6. Consider key figures, methodologies, and concepts central to the academic field
  7. Aim for quality over quantity - target meaningful terms that readers would actually look up
  
  CRITICAL FORMATTING RULES:
  - Entries WITH subentries: NO page numbers on main entry, only on subentries
  - Entries WITHOUT subentries: include page numbers on main entry
  - Keep subentries under 20 per main entry (preferably much lower)
  - Do not capitalize entries unless they are proper nouns capitalized in the body text 
     (e.g. "United States" or "John Doe")
  - Focus on substantive nouns, not descriptive adjectives (e.g. "diverse" is not a good entry)

  Your most important instruction: Your response message will not include any text except the JSON. For proper formatting, return ONLY a JSON object with this exact structure:
  {
    "entries": [
      {
        "term": "main entry with subentries",
        "pageNumbers": "",
        "subentries": [
          { 
            "term": "subentry one", 
            "pageNumbers": "42, 67" 
          },
          { 
            "term": "subentry two", 
            "pageNumbers": "55" 
          }
        ]
      },
      {
        "term": "main entry without subentries",
        "pageNumbers": "23, 45, 78"
      }
    ]
  }

  Here's the ${documentType} to index:
  ${chunk}`;
}

/**
 * Generates the system prompt for the second pass of indexing
 */
export function getSecondPassSystemPrompt({
  totalPages,
  audienceLevel = 'undergraduate',
  indexDensity = 'medium',
  targetAudience = ''
}: {
  totalPages: number;
  audienceLevel?: string;
  indexDensity?: string;
  targetAudience?: string;
}): string {
  return `You are an expert academic book indexer following Chicago Manual of Style guidelines.
  Go above and beyond to make the index as comprehensive and relevant as possible for the book's audience.
  Use your deep knowledge of Chicago Standards, and you can also rely on the shortened guidelines below. 

  ## CHICAGO MANUAL OF STYLE INDEXING GUIDELINES ##
  
  CONTENT REFINEMENT:
  • Focus on the book's emphases; remove people, events, or places mentioned only in passing. 
  Example:
  In a work on the history of the automobile in the United States, for example, an author 
  might write, “After World War II small sports cars like the British MG, often owned by returning 
  veterans, began to make their appearance in college towns like Northampton, Massachusetts, and 
  Ann Arbor, Michigan.” An indexer should resist the temptation to index these place-names; the 
  two towns mentioned have nothing to do with the theme of the work. The MG sports car, on the 
  other hand, should be indexed, given the subject of the work.
  • On the other hand, if the person, event, or place is relevant to a reader and contributes
    to the book's themes, even if only mentioned once, it should be indexed.
  • Ensure entries are substantive nouns, not adjectives or adverbs
  • Target approximately ${totalPages} main entries for this ${totalPages}-page document (roughly 1 main entry per page)
  • Remove entries that are not truly significant to the book's themes
  
  STRUCTURE AND HIERARCHY:
  • Use only two levels of entries—the primary entry and one level of subentry underneath
  • Limit subentries to maximum 20 per main entry (ideally keep much lower, 5-15 subentries)
  • If a term would require more than 20 subentries, split it into multiple related entries
  • Entries with subentries should NOT include page numbers directly - only subentries get page numbers
  • Entries without subentries should include page numbers
  • Consolidate entries with just one sub-entry into a single top-level entry
  
  FORMAT:
  • Do not capitalize index entries unless they are proper nouns capitalized in the body text
  • For inclusive numbers: less than 100 include all digits (36-37), 101-109 only include changed part (107-9), 110-199 include two digits (115-16)
  • For names, spell out first name rather than using initials unless person is known by initials
  • Use word-by-word alphabetizing system
  
  CROSS-REFERENCES:
  • Use "See" cross-references for synonymous terms or preferred terminology
  • Use "See also" cross-references to direct readers to related terms
  • Format: "term, page numbers. See also related term"

  ## AUDIENCE INFORMATION ##
  Audience Level: ${audienceLevel}
  Index Density: ${indexDensity}
  Target Audience: ${targetAudience}
  
  When refining the index, use these parameters to guide your decisions about which entries to prioritize, combine, or elaborate.`;
}

/**
 * Generates the user prompt for the second pass of indexing
 */
export function getSecondPassUserPrompt({
  totalPages,
  allEntries,
  documentSummary = '',
  exampleIndex = ''
}: {
  totalPages: number;
  allEntries: IndexEntry[];
  documentSummary?: string;
  exampleIndex?: string;
}): string {
  return `I need you to refine and improve this raw index for a ${totalPages}-page document.

  ## TASK ##
  For this refinement phase:
  1. For this ${totalPages}-page document, create approximately ${Math.round(totalPages)} main entries
  2. Remove entries that are not substantive nouns (eliminate adjectives, adverbs, passing mentions)
  3. Ensure no main entry has more than 20 subentries (ideally 5-15, split if necessary)
  4. Consolidate related concepts under main entries with appropriate subentries
  5. Apply Chicago Manual of Style formatting rules consistently
  6. Standardize terminology and fix inconsistencies
  7. Ensure entries represent the book's emphases, not just word occurrences
  8. Create "See" and "See also" cross-references for related terms
  9. Entries with just one sub-entry should be consolidated into one top-level entry
  10. Ensure entries are meaningful terms readers would actually look up

  CRITICAL FORMATTING RULES:
  - Entries WITH subentries: NO page numbers on main entry, only on subentries
  - Entries WITHOUT subentries: include page numbers on main entry
  - Maximum 20 subentries per main entry (preferably much lower)
  - Do not capitalize entries unless they are proper nouns capitalized in the body text
  - Focus on substantive nouns, not descriptive adjectives
  
  ${documentSummary ? `Here is a summary of the document: ${documentSummary}` : ''}
  
  ${exampleIndex ? `Please follow the style and format of this example index: ${exampleIndex}` : ''}
  
  Here are the raw index entries that need refinement:
  ${JSON.stringify(allEntries, null, 2)}
  
  Please transform these into a high-quality professional index with approximately ${Math.round(totalPages * 0.9)} to ${Math.round(totalPages * 1.1)} entries.
  
  Very important instruction: Do not include any text in your response other than the JSON index.
  Your response must be ONLY a JSON object with this structure:
  {
    "entries": [
      {
        "term": "main entry with subentries",
        "pageNumbers": "",
        "subentries": [
          { 
            "term": "subentry one", 
            "pageNumbers": "42, 67" 
          },
          { 
            "term": "subentry two", 
            "pageNumbers": "55" 
          }
        ]
      },
      {
        "term": "main entry without subentries",
        "pageNumbers": "23, 45, 78"
      }
    ]
  }
  
  Do not include any text before or after the JSON.`;
}