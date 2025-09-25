// src/app/api/generate-index/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { handleFirstPass, handleSecondPass, FirstPassRequest, SecondPassRequest } from '@/utils/apiHandlers';

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { isSecondPass = false } = requestData;

    // Route to appropriate handler
    if (isSecondPass) {
      const secondPassRequest: SecondPassRequest = {
        allEntries: requestData.allEntries,
        totalPages: requestData.totalPages,
        exampleIndex: requestData.exampleIndex || '',
        documentSummary: requestData.documentSummary || '',
        audienceLevel: requestData.audienceLevel || 'undergraduate',
        indexDensity: requestData.indexDensity || 'medium',
        targetAudience: requestData.targetAudience || '',
        specialInstructions: requestData.specialInstructions || ''
      };
      
      return await handleSecondPass(secondPassRequest);
    } else {
      const firstPassRequest: FirstPassRequest = {
        chunk: requestData.chunk,
        chunkIndex: requestData.chunkIndex,
        totalChunks: requestData.totalChunks,
        totalPages: requestData.totalPages,
        previousEntries: requestData.previousEntries || [],
        exampleIndex: requestData.exampleIndex || '',
        audienceLevel: requestData.audienceLevel || 'undergraduate',
        indexDensity: requestData.indexDensity || 'medium',
        targetAudience: requestData.targetAudience || '',
        specialInstructions: requestData.specialInstructions || ''
      };
      
      return await handleFirstPass(firstPassRequest);
    }
  } catch (error) {
    console.error('Index generation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate index',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}