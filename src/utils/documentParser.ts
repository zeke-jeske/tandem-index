// src/utils/documentParser.ts
import mammoth from 'mammoth';

interface TextSegment {
  text: string;
}

interface ParsedDocument {
  segments: TextSegment[];
  fullText: string;
  error?: string;
}

/**
 * Parses a DOCX file and extracts text segments
 */
export async function parseDocumentSample(file: File): Promise<ParsedDocument> {
  try {
    // Convert the file to an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Use mammoth to extract text - with correct options
    const result = await mammoth.extractRawText({
      arrayBuffer: arrayBuffer
      // Remove the includeEmbeddedStyleMap option as it's not recognized
    });
    
    const fullText = result.value;
    
    // Split into paragraphs
    const paragraphs = fullText.split('\n\n')
      .filter(p => p.trim().length > 20); // Filter out short paragraphs
    
    const segments: TextSegment[] = paragraphs
      .filter(paragraph => {
        // Skip if it looks like a header or page number (simple heuristic)
        return !(paragraph.length < 20 || /^[\d\s]+$/.test(paragraph));
      })
      .map(paragraph => ({ text: paragraph }));
    
    if (segments.length < 3) {
      return {
        segments,
        fullText,
        error: "This document doesn't contain enough text content for verification. Please upload a document with more substantial text."
      };
    }
    
    return { segments, fullText };
    
  } catch (error) {
    console.error('Error parsing document:', error);
    return {
      segments: [],
      fullText: '',
      error: "Failed to parse the document. Please ensure it's a valid DOCX file."
    };
  }
}

/**
 * Selects random passages from the document for verification
 */
export function selectRandomPassages(parsedDoc: ParsedDocument, count: number = 3): TextSegment[] {
  const { segments } = parsedDoc;
  
  if (segments.length <= count) {
    return segments;
  }
  
  const selectedSegments: TextSegment[] = [];
  const usedIndices = new Set<number>();
  
  // Select segments from different parts of the document
  const documentParts = Math.ceil(segments.length / count);
  
  for (let i = 0; i < count; i++) {
    const startIdx = i * documentParts;
    const endIdx = Math.min((i + 1) * documentParts, segments.length);
    
    // Find a random segment in this section that hasn't been used
    let attempts = 0;
    let randomIdx;
    
    do {
      randomIdx = startIdx + Math.floor(Math.random() * (endIdx - startIdx));
      attempts++;
    } while (usedIndices.has(randomIdx) && attempts < 10);
    
    if (attempts < 10) {
      usedIndices.add(randomIdx);
      
      // Extract a shorter phrase from the segment (5-10 words)
      const words = segments[randomIdx].text.split(/\s+/);
      if (words.length > 10) {
        const startWordIdx = Math.floor(Math.random() * (words.length - 10));
        const extractedWords = words.slice(startWordIdx, startWordIdx + 5 + Math.floor(Math.random() * 6));
        
        selectedSegments.push({
          text: extractedWords.join(' ')
        });
      } else {
        // If segment is already short, use the whole thing
        selectedSegments.push(segments[randomIdx]);
      }
    }
  }
  
  return selectedSegments;
}