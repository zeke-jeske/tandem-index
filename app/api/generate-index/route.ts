// src/app/api/generate-index/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface IndexEntry {
  term: string;
  pageNumbers: string;
  subentries?: {
    term: string;
    pageNumbers: string;
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const { 
      chunk, 
      chunkIndex, 
      totalChunks, 
      totalPages,
      previousEntries = [], 
      exampleIndex = ''
    } = await request.json();

    if (!chunk || typeof chunk !== 'string') {
      return NextResponse.json(
        { error: 'Invalid document chunk provided' },
        { status: 400 }
      );
    }
  
    // Check if the chunk is too large
    let processedChunk = chunk;
    if (processedChunk.length > 80000) {  
      console.log(`Chunk size (${processedChunk.length} chars) exceeds safe limit. Truncating...`);
      processedChunk = processedChunk.substring(0, 80000);
    }
  
    // Calculate the approximate page range for this chunk
    const pagesPerChunk = totalPages / totalChunks;
    const startPage = Math.max(1, Math.floor(chunkIndex * pagesPerChunk));
    const endPage = Math.min(totalPages, Math.floor((chunkIndex + 1) * pagesPerChunk));
    
    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} (pages ~${startPage}-${endPage}) with length ${processedChunk.length}`);
    
    // Create a comprehensive system prompt for high-quality indexing
    const systemPrompt = `You are an expert book indexer for academic books following Chicago Manual of Style guidelines. 
    You create professional indexes for chapters of academic books with these requirements:

    1. Identify key concepts, terms, people, places, and themes that readers would likely look up
    2. Include specific page numbers, not just page ranges for entire sections
    3. Create a hierarchical structure with main entries and subentries when appropriate
    4. Use see/see also cross-references for related terms
    5. Follow consistent formatting: 
      - Lowercase terms except for proper nouns
      - Use commas between terms and page numbers
      - Use semicolons to separate different aspects of the same term
      - Sort alphabetically

    You write every index in JSON format according to the specified JSON below. 
    You do not include any text before or after the JSON index. 
    Each entry MUST include specific page numbers, not just generic ranges covering the entire chunk.
    When determining page numbers, estimate based on the included page numbers in the text,
    the text's position in the full text, and the page range.`;

    // Full prompt instead of simplified
    try {
      console.log('Making full indexing API call...');
      
      const fullResponse = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 5000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Create a professional index for this book excerpt. The excerpt spans approximately pages ${startPage} to ${endPage}.
            Your most important instruction: Your response message will not include any text except the JSON. For proper formatting, return ONLY a JSON object with this exact structure:
            {
              "entries": [
                {
                  "term": "main entry term",
                  "pageNumbers": "specific page numbers, not just ranges",
                  "subentries": [
                    { 
                      "term": "subentry term", 
                      "pageNumbers": "specific page numbers" 
                    }
                  ]
                }
              ]
            }

            Here's the text to index:
            ${processedChunk}`
          }
        ]
      });
      
      console.log('Response type:', typeof fullResponse);
      
      // Extract the response content
      let responseText = '';
      if (Array.isArray(fullResponse.content)) {
        for (const contentBlock of fullResponse.content) {
          if (contentBlock.type === 'text') {
            responseText = contentBlock.text;
            break;
          }
        }
      }
      
      if (!responseText) {
        console.error('No text content in Claude response:', fullResponse);
        throw new Error('No text content received from Claude API');
      }
      
      console.log('Extracted text content:', responseText.substring(0, 2000));
      
      // Try to extract and parse JSON
      try {
        let parsedData: any = [];
        let indexEntries: { entries: { term: string; pageNumbers: string; subentries?: { term: string; pageNumbers: string; }[] }[] } = { entries: [] };

        // Try to extract JSON content
        if (responseText.includes('```json')) {
          // Extract content between json code blocks
          const jsonContent = responseText.split('```json')[1]?.split('```')[0]?.trim();
          console.log('Extracted JSON content:', jsonContent?.substring(0, 100) + '...');

          if (jsonContent) {
            try {
              // Try to parse the JSON content
              const parsed = JSON.parse(jsonContent);
              console.log('Successfully parsed JSON:', typeof parsed);
              
              // Handle different response formats
              if (Array.isArray(parsed)) {
                // Handle array format
                indexEntries.entries = parsed.map((item: any) => ({
                  term: item.term || 'unknown term',
                  pageNumbers: item.page ? String(item.page) : 
                              item.pages ? Array.isArray(item.pages) ? item.pages.join(', ') : String(item.pages) : 
                              `${startPage}-${endPage}`,
                  subentries: item.subentries || []
                }));
              } else if (parsed.entries) {
                // Handle {entries: [...]} format (preferred format)
                indexEntries = parsed;
              } else if (parsed.index_entries) {
                // Handle {index_entries: [...]} format
                indexEntries.entries = parsed.index_entries.map((item: any) => ({
                  term: item.term || 'unknown term',
                  pageNumbers: item.page ? String(item.page) : `${startPage}-${endPage}`,
                  subentries: item.subentries || []
                }));
              } else if (parsed.indexEntries) {
                // Handle {indexEntries: [...]} format
                indexEntries.entries = parsed.indexEntries.map((item: any) => ({
                  term: item.term || 'unknown term',
                  pageNumbers: item.page ? String(item.page) : `${startPage}-${endPage}`,
                  subentries: item.subentries || []
                }));
              }
            } catch (parseError) {
              console.error('JSON parse error:', parseError);
              // Extract terms using regex as fallback
              const terms = jsonContent.match(/"term"\s*:\s*"([^"]*)"/g);
              if (terms) {
                indexEntries.entries = terms.map(t => {
                  const term = t.split(':')[1]?.replace(/"/g, '').trim() || 'unknown term';
                  return { term, pageNumbers: `${startPage}-${endPage}` };
                });
              }
            }
          }
        } else {
          // Try to parse the whole response as JSON
          try {
            const parsed = JSON.parse(responseText);
            if (parsed.entries) {
              indexEntries = parsed;
            }
          } catch (e) {
            console.log('Response is not JSON');
          }
        }
        
        // Filter out any entries with undefined terms
        indexEntries.entries = indexEntries.entries.filter(entry => 
          entry && entry.term && entry.term !== 'undefined' && entry.term !== 'unknown term'
        );
        
        console.log(`Parsed ${indexEntries.entries?.length || 0} index entries`);
        
        return NextResponse.json({
          success: true,
          entries: indexEntries.entries
        });
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        return NextResponse.json({
          success: true,
          warning: "Failed to parse response, using fallback entries",
          entries: [
            { term: "indexing", pageNumbers: `${startPage}` },
            { term: "book content", pageNumbers: `${startPage}-${endPage}` }
          ]
        });
      }
    } catch (apiError) {
      console.error('Claude API error details:', apiError);
      return NextResponse.json({
        success: false,
        error: apiError instanceof Error ? apiError.message : 'Unknown API error',
        details: JSON.stringify(apiError)
      }, { status: 500 });
    }
  } catch (outerError) {
    console.error('Index generation error:', outerError);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate index',
        details: outerError instanceof Error ? outerError.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}