// src/app/api/generate-index/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getIndexingSystemPrompt, getExampleIndexPrompt, getFullIndexGenerationPrompt } from '@/utils/indexingPrompts';

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
    if (processedChunk.length > 100000) {
      console.log(`Chunk size (${processedChunk.length} chars) exceeds safe limit. Truncating...`);
      processedChunk = processedChunk.substring(0, 100000);
    }

    // Calculate the approximate page range for this chunk
    const pagesPerChunk = totalPages / totalChunks;
    const startPage = Math.max(1, Math.floor(chunkIndex * pagesPerChunk));
    const endPage = Math.min(totalPages, Math.floor((chunkIndex + 1) * pagesPerChunk));
    
    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} (pages ~${startPage}-${endPage}) with length ${processedChunk.length}`);
    
    // Construct prompts
    const systemPrompt = getIndexingSystemPrompt(totalPages, !!exampleIndex);
    
    // Build the user prompt
    let userPrompt = getFullIndexGenerationPrompt(
      processedChunk, 
      chunkIndex, 
      totalChunks, 
      { start: startPage, end: endPage },
      previousEntries.length > 0 ? JSON.stringify(previousEntries.slice(0, 30), null, 2) : ""
    );
    
    // Include example index if provided
    if (exampleIndex) {
      userPrompt = getExampleIndexPrompt(exampleIndex) + "\n\n" + userPrompt;
    }
    
    console.log('Making API call to Claude 3 Sonnet...');
    
    // Try with error handling
    try {
      // Call Claude API with model selected for quality and cost balance
      const response = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229", // Using Sonnet as a balance of quality and cost
        system: systemPrompt,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      });
      
      console.log('Received response from Claude');
      
      // Extract the response content
      let responseText = '';
      if (Array.isArray(response.content)) {
        for (const contentBlock of response.content) {
          if (contentBlock.type === 'text') {
            responseText = contentBlock.text;
            break;
          }
        }
      }
      
      if (!responseText) {
        console.error('No text content in Claude response:', response);
        throw new Error('No text content received from Claude API');
      }
      
      // Parse the JSON response from Claude
      let indexEntries: { entries: IndexEntry[] } = { entries: [] };
      
      try {
        // Try to extract just the JSON object
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          indexEntries = JSON.parse(jsonMatch[0]);
        } else {
          console.error('No JSON found in response:', responseText);
          // Create a basic entries array as fallback
          indexEntries = { 
            entries: [
              { 
                term: "indexing error", 
                pageNumbers: `${startPage}`, 
                subentries: [
                  { term: "failed to parse JSON response", pageNumbers: `${startPage}` }
                ]
              }
            ]
          };
        }
        
        console.log(`Parsed ${indexEntries.entries?.length || 0} index entries`);
        
        return NextResponse.json({
          success: true,
          entries: indexEntries.entries || []
        });
        
      } catch (parseError) {
        console.error('Failed to parse Claude response:', parseError);
        console.error('Raw response text:', responseText);
        
        // Try a more flexible approach to extract JSON
        try {
          const jsonStartIndex = responseText.indexOf('{');
          const jsonEndIndex = responseText.lastIndexOf('}') + 1;
          
          if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
            const jsonCandidate = responseText.substring(jsonStartIndex, jsonEndIndex);
            indexEntries = JSON.parse(jsonCandidate);
            
            console.log(`Recovered ${indexEntries.entries?.length || 0} entries using flexible parsing`);
            
            return NextResponse.json({
              success: true,
              entries: indexEntries.entries || [],
              warning: "Used alternative JSON parsing method"
            });
          }
        } catch (fallbackError) {
          console.error('Fallback parsing also failed:', fallbackError);
        }
        
        return NextResponse.json(
          { 
            error: 'Failed to parse index entries',
            rawResponse: responseText.substring(0, 500) + "..." // Truncate for logs
          },
          { status: 500 }
        );
      }
    } catch (claudeError) {
      console.error('Claude API error:', claudeError);
      
      // Try with a simpler model if the first one failed
      try {
        console.log('Retrying with Claude 3 Haiku model...');
        
        const backupResponse = await anthropic.messages.create({
          model: "claude-3-haiku-20240307", // Fallback to a simpler model
          system: "You are a book indexing assistant. Create index entries for this book text.",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: `Create 5-10 index entries for this book text, focusing on key concepts. The book has ${totalPages} pages, and this section covers pages ${startPage}-${endPage}. Format your response as JSON with entries array.\n\n${processedChunk.substring(0, 50000)}`
            }
          ]
        });
        
        let backupResponseText = '';
        if (Array.isArray(backupResponse.content)) {
          for (const contentBlock of backupResponse.content) {
            if (contentBlock.type === 'text') {
              backupResponseText = contentBlock.text;
              break;
            }
          }
        }
        
        // Try to parse simple JSON
        const jsonMatch = backupResponseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const fallbackEntries = JSON.parse(jsonMatch[0]);
          
          return NextResponse.json({
            success: true,
            entries: fallbackEntries.entries || [],
            fallback: true
          });
        }
        
        // If still failing, create some very basic entries
        return NextResponse.json({
          success: true,
          entries: [
            { 
              term: "book content", 
              pageNumbers: `${startPage}-${endPage}` 
            },
            { 
              term: "index", 
              pageNumbers: `${startPage}`,
              subentries: [
                { term: "automated generation", pageNumbers: `${startPage}` }
              ]
            }
          ],
          fallback: true
        });
        
      } catch (fallbackError) {
        console.error('Fallback model also failed:', fallbackError);
        
        return NextResponse.json(
          { 
            error: 'All Claude API attempts failed',
            details: `Primary error: ${claudeError instanceof Error ? claudeError.message : 'Unknown error'}, Fallback error: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
          },
          { status: 500 }
        );
      }
    }
    
  } catch (error) {
    console.error('Index generation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate index',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}