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
  const { 
    chunk, 
    chunkIndex, 
    totalChunks, 
    totalPages,
    previousEntries = [], 
    exampleIndex = '',
    isSecondPass = false  // New parameter
  } = await request.json();

  try {

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
    

      const systemPrompt = `You are an expert book indexer for academic books following Chicago Manual of Style guidelines. 
      You are analyzing a chunk of text to identify potential index terms.

      For this FIRST PASS, focus on:
      1. Identifying ALL potentially index-worthy terms, concepts, people, places, and themes
      2. Cast a wide net - it's better to include too many terms than miss important ones
      3. Include specific page numbers based on your estimate of where content appears in this chunk
      4. Create a basic hierarchical structure for obviously related terms
      5. Focus on terms that readers would likely look up
      6. Include both explicit terms mentioned in the text AND implicit concepts discussed

      Remember:
      - This is just the first pass to gather candidates
      - Another pass will refine these terms later
      - Aim for comprehensive coverage rather than perfect organization
      - For a ${totalPages} page document, we should eventually have about ${totalPages} total entries
      - Include page numbers, not just page ranges for entire sections.`;

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

async function handleSecondPass(request: NextRequest) {
  try {
    const { 
      allEntries,
      totalPages,
      exampleIndex = '',
      documentSummary = ''
    } = await request.json();

    if (!allEntries || !Array.isArray(allEntries) || allEntries.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty entries provided for refinement' },
        { status: 400 }
      );
    }

    if (!totalPages || typeof totalPages !== 'number' || totalPages <= 0) {
      return NextResponse.json(
        { error: 'Valid document page count is required' },
        { status: 400 }
      );
    }

    console.log(`Starting second pass refinement for ${allEntries.length} entries in a ${totalPages}-page document`);
    
    const systemPrompt = `You are an expert book indexer following Chicago Manual of Style guidelines.
    Your task is to refine and organize a raw list of index entries to create a professional, coherent index.

    For this refinement phase:
    1. Evaluate the relevance of each entry to the overall document theme
    2. Remove truly irrelevant entries that wouldn't help readers
    3. Consolidate related concepts under main entries with appropriate subentries
    4. Ensure proper hierarchical organization (main entries vs. subentries)
    5. Standardize terminology and fix inconsistencies
    6. Maintain approximately 1 index entry per page of content, aiming for ${Math.round(totalPages * 0.9)} to ${Math.round(totalPages * 1.1)} total entries
    7. For concepts that appear on the same page numbers, combine them into main/sub relationships when appropriate
    8. Convert overly specific entries into broader concepts
    9. Ensure entries are distributed across the document's page range
    10. Ensure page numbers are specific and accurate, not just broad ranges
    11. Fix any inconsistent formatting of terms and page numbers
    12. Create see/see also cross-references for related terms
    
    Focus on creating an index that will be genuinely useful to readers. Think about what terms readers might look up.`;

    try {
      console.log('Making refinement API call...');
      
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `I need you to refine and improve this raw index for a ${totalPages}-page document.
            
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
                  "term": "main entry term",
                  "pageNumbers": "specific page numbers",
                  "subentries": [
                    { 
                      "term": "subentry term", 
                      "pageNumbers": "specific page numbers" 
                    }
                  ]
                }
              ]
            }
            
            Do not include any text before or after the JSON.`
          }
        ]
      });
      
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
      
      console.log('Received refinement response of length:', responseText.length);
      
      // Try to extract and parse JSON
      try {
        // Clean the response text to extract just the JSON
        let jsonText = responseText;
        
        // If the response starts with ```json and ends with ```, extract just the JSON part
        if (jsonText.includes('```json')) {
          jsonText = jsonText.split('```json')[1].split('```')[0].trim();
        } 
        // Remove any markdown code block markers without language specification
        else if (jsonText.includes('```')) {
          jsonText = jsonText.split('```')[1].split('```')[0].trim();
        }
        
        // Try to find valid JSON in the response using a regex
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
        
        console.log('Parsing JSON from refined response...');
        
        const refinedData = JSON.parse(jsonText);
        
        if (!refinedData.entries || !Array.isArray(refinedData.entries)) {
          console.error('Invalid refined entries structure:', refinedData);
          throw new Error('Refined entries missing or not in expected format');
        }
        
        console.log(`Successfully parsed ${refinedData.entries.length} refined entries`);
        
        // Filter out any entries with undefined or empty terms
        const filteredEntries = refinedData.entries.filter((entry: any) => 
          entry && 
          entry.term && 
          entry.term.trim() !== '' && 
          entry.term.toLowerCase() !== 'undefined' &&
          entry.term.toLowerCase() !== 'unknown term'
        );
        
        // Sort entries alphabetically
        filteredEntries.sort((a:any, b:any) => {
          if (!a.term) return 1;  // Move undefined terms to the end
          if (!b.term) return -1; // Move undefined terms to the end
          return a.term.localeCompare(b.term);
        });
        
        // For each entry, sort its subentries
        filteredEntries.forEach((entry: any) => {
          if (entry.subentries && entry.subentries.length > 0) {
            entry.subentries.sort((a:any, b:any) => a.term.localeCompare(b.term));
          }
        });
        
        return NextResponse.json({
          success: true,
          entries: filteredEntries
        });
        
      } catch (parseError) {
        console.error('Failed to parse refined response:', parseError);
        console.error('Response text:', responseText.substring(0, 500) + '...');
        
        // Return the original entries with a warning
        return NextResponse.json({
          success: true,
          warning: "Failed to parse refined response, using original entries",
          entries: allEntries
        });
      }
      
    } catch (apiError) {
      console.error('Claude API error during refinement:', apiError);
      
      // Return the original entries with a warning
      return NextResponse.json({
        success: true,
        warning: "API error during refinement, using original entries",
        entries: allEntries
      });
    }
    
  } catch (error) {
    console.error('Second pass processing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to refine index entries',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}