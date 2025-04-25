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
    const requestData = await request.json();
    const { 
      chunk, 
      chunkIndex, 
      totalChunks, 
      totalPages,
      previousEntries = [], 
      exampleIndex = '',
      isSecondPass = false,
      audienceLevel = 'undergraduate', // Default value
      indexDensity = 'medium', // Default value
      targetAudience = '' // Default value
    } = requestData;

    // If this is the second pass, use a different handler with the already parsed data
    if (isSecondPass) {
      return await handleSecondPass(requestData);
    }

    // First pass validation
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

    try {
      console.log('Making full indexing API call...');
      
      const fullResponse = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 5000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Create a professional index for this book excerpt. The excerpt spans approximately pages ${startPage} to ${endPage}.

                ## TASK ##
                For this FIRST PASS, focus on:
                1. Identifying ALL potentially index-worthy terms, concepts, people, places, and themes
                2. Cast a wide net - include many terms even if you're unsure of their importance
                3. Be generous with your identification - aim for quantity at this stage
                4. Include specific page numbers based on your estimate of where content appears in this chunk
                5. Create hierarchical structure for terms that are especially broad (about 30% of the terms should be broad terms).
                6. Consider explicitly named authors and people as well as abstract concepts and themes that might not be explicitly named
                7. Try to identify at least 20-30 terms or phrases for this chunk of text. 
                
                Remember:
                - This is just the first pass to gather candidates
                - Another pass will refine these terms later
                - Aim for comprehensive coverage rather than perfect organization
                - Include terms at varying levels of specificity (both general and specific concepts)
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
      
      console.log('Extracted text content:', responseText);
      
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
                if (!Array.isArray(parsed) && (parsed as any).entries || (parsed as any).index_entries || (parsed as any).indexEntries) {
                // Handle different formats for entries
                const entries = !Array.isArray(parsed) && (parsed as { entries?: any[]; index_entries?: any[]; indexEntries?: any[] }).entries || (parsed as { entries?: any[]; index_entries?: any[]; indexEntries?: any[] }).index_entries || (parsed as { entries?: any[]; index_entries?: any[]; indexEntries?: any[] }).indexEntries;
                indexEntries.entries = (entries ?? []).map((item: any) => ({
                  term: item.term || 'unknown term',
                  pageNumbers: item.page ? String(item.page) : 
                        item.pages ? Array.isArray(item.pages) ? item.pages.join(', ') : String(item.pages) : 
                        `${startPage}-${endPage}`,
                  subentries: item.subentries || []
                }));
                }
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

async function handleSecondPass(requestData: any) {
  try {
    const { 
      allEntries,
      totalPages,
      exampleIndex = '',
      documentSummary = '',
      audienceLevel = 'undergraduate', // Default value
      indexDensity = 'medium', // Default value
      targetAudience = '' 
    } = requestData;

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
    
    const systemPrompt = `You are an expert academic book indexer following Chicago Manual of Style guidelines.

    ## AUDIENCE INFORMATION ##
    Audience Level: ${audienceLevel}
    Index Density: ${indexDensity}
    Target Audience: ${targetAudience}
    
    When refining the index, use these parameters to guide your decisions about which entries to prioritize, combine, or elaborate.`;
    
    try {
      console.log('Making refinement API call...');
      
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `I need you to refine and improve this raw index for a ${totalPages}-page document.

                ## TASK ##
                Refine and organize a raw list of index entries to create a professional, coherent index.

                For this refinement phase:
                1. For this ${totalPages}-page document, create approximately ${Math.round(totalPages)} entries
                2. Maintain breadth of coverage - preserve most terms from the first pass
                3. Only remove entries that are truly irrelevant to the book's audience or redundant
                4. Consolidate related concepts under main entries with appropriate subentries
                5. Ensure proper hierarchical organization (main entries vs. subentries)
                6. Standardize terminology and fix inconsistencies
                7. For concepts that appear on the same page numbers, combine them only when truly related
                8. Ensure entries are distributed across the document's page range
                9. Create see/see also cross-references for related terms
                10. Entries with just one sub-entry should be consolidated into one top-level entry.

                DO NOT over-consolidate entries.
            
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