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
    if (processedChunk.length > 30000) {
      console.log(`Chunk size (${processedChunk.length} chars) exceeds safe limit. Truncating...`);
      processedChunk = processedChunk.substring(0, 30000);
    }
  
    // Calculate the approximate page range for this chunk
    const pagesPerChunk = totalPages / totalChunks;
    const startPage = Math.max(1, Math.floor(chunkIndex * pagesPerChunk));
    const endPage = Math.min(totalPages, Math.floor((chunkIndex + 1) * pagesPerChunk));
    
    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} (pages ~${startPage}-${endPage}) with length ${processedChunk.length}`);
    
    // Attempting simplified API call
    try {
      console.log('Attempting simplified API call...');
      
      const simplifiedResponse = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 5000,
        messages: [
          {
            role: "user",
            content: "Create 5 basic index entries for this text. Response as JSON:\n\n" + 
              processedChunk.substring(0, 5000)
          }
        ]
      });
      
      console.log('Response type:', typeof simplifiedResponse);
      console.log('Response structure:', JSON.stringify(simplifiedResponse, null, 2).substring(0, 500));
      
      // Extract the response content
      let responseText = '';
      if (Array.isArray(simplifiedResponse.content)) {
        for (const contentBlock of simplifiedResponse.content) {
          if (contentBlock.type === 'text') {
            responseText = contentBlock.text;
            break;
          }
        }
      }
      
      if (!responseText) {
        console.error('No text content in Claude response:', simplifiedResponse);
        throw new Error('No text content received from Claude API');
      }
      
      console.log('Extracted text content:', responseText.substring(0, 200));
      
      // Try to extract and parse JSON
      try {
        let parsedData: any = [];
        let indexEntries: { entries: IndexEntry[] } = { entries: [] };

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
                indexEntries.entries = parsed.map(item => ({
                  term: item.term,
                  pageNumbers: item.page ? String(item.page) : 
                              item.pages ? String(item.pages) : 
                              `${startPage}-${endPage}`
                }));
              } else if (parsed.index_entries) {
                // Handle {index_entries: [...]} format
                indexEntries.entries = parsed.index_entries.map((item: any) => ({
                  term: item.term,
                  pageNumbers: item.page ? String(item.page) : `${startPage}-${endPage}`
                }));
              } else if (parsed.indexEntries) {
                // Handle {indexEntries: [...]} format
                indexEntries.entries = parsed.indexEntries.map((item: any) => ({
                  term: item.term,
                  pageNumbers: item.page ? String(item.page) : `${startPage}-${endPage}`
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
        }
        
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