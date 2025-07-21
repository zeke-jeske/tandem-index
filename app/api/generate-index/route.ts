// src/app/api/generate-index/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { 
  getFirstPassSystemPrompt, 
  getFirstPassUserPrompt, 
  getSecondPassSystemPrompt, 
  getSecondPassUserPrompt,
  validateAndFixFormatting
} from '@/utils/indexingPrompts';

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
  
    // REMOVED: No more arbitrary truncation!
    // The chunking should be handled properly in the frontend
    
    // Calculate the approximate page range for this chunk
    const pagesPerChunk = totalPages / totalChunks;
    const startPage = Math.max(1, Math.floor(chunkIndex * pagesPerChunk));
    const endPage = Math.min(totalPages, Math.floor((chunkIndex + 1) * pagesPerChunk));
    
    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} (pages ~${startPage}-${endPage}) with length ${chunk.length}`);

    const systemPrompt = getFirstPassSystemPrompt({
      totalPages,
      exampleIndex,
      previousEntries,
      audienceLevel,
      indexDensity,
      targetAudience
    });

    try {
      console.log('Making full indexing API call...');
      
      const fullResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-0",
        max_tokens: 5000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: getFirstPassUserPrompt(startPage, endPage, chunk)
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
          // Try to extract and parse JSON
          try {
            let indexEntries: { entries: { term: string; pageNumbers: string; subentries?: { term: string; pageNumbers: string; }[] }[] } = { entries: [] };
            
            // Clean up the response text and try to parse it
            let jsonText = responseText;
            
            // If the response is wrapped in code blocks, extract just the JSON
            if (jsonText.includes('```json')) {
              jsonText = jsonText.split('```json')[1].split('```')[0].trim();
            }
            
            // Try to parse the JSON
            const parsed = JSON.parse(jsonText);
            
            // No matter what format comes back, extract the entries array
            let entries: any[] = [];
            
            if (Array.isArray(parsed)) {
              // It's already an array of entries
              entries = parsed;
            } else if (parsed && typeof parsed === 'object') {
              // It's an object with entries inside
              entries = parsed.entries || parsed.index_entries || parsed.indexEntries || [];
            }
            
            // Standardize the entries format
            indexEntries.entries = entries.map((item: any) => ({
              term: item.term || 'unknown term',
              pageNumbers: item.pageNumbers || item.page_numbers || 
                          (item.pages ? String(item.pages) : `${startPage}-${endPage}`),
              subentries: item.subentries || []
            }));
            
            // Filter out any entries with undefined terms
            indexEntries.entries = indexEntries.entries.filter(entry => 
              entry && entry.term && entry.term !== 'undefined' && entry.term !== 'unknown term'
            );
            
            // Validate and fix formatting according to Chicago Manual of Style
            indexEntries.entries = validateAndFixFormatting(indexEntries.entries);
            
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
        
        // Validate and fix formatting according to Chicago Manual of Style
        indexEntries.entries = validateAndFixFormatting(indexEntries.entries);
        
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
    
    const systemPrompt = getSecondPassSystemPrompt({
      totalPages,
      audienceLevel,
      indexDensity,
      targetAudience
    });
    
    try {
      console.log('Making refinement API call...');
      
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-0",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: getSecondPassUserPrompt({
              totalPages,
              allEntries,
              documentSummary,
              exampleIndex
            })
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
        
        // Validate and fix formatting according to Chicago Manual of Style
        const validatedEntries = validateAndFixFormatting(filteredEntries);
        
        // Sort entries alphabetically
        validatedEntries.sort((a:any, b:any) => {
          if (!a.term) return 1;  // Move undefined terms to the end
          if (!b.term) return -1; // Move undefined terms to the end
          return a.term.localeCompare(b.term);
        });
        
        // For each entry, sort its subentries
        validatedEntries.forEach((entry: any) => {
          if (entry.subentries && entry.subentries.length > 0) {
            entry.subentries.sort((a:any, b:any) => a.term.localeCompare(b.term));
          }
        });
        
        return NextResponse.json({
          success: true,
          entries: validatedEntries
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