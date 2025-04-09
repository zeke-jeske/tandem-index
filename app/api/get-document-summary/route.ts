// app/api/get-document-summary/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Invalid text provided' },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Use a smaller model for speed
      max_tokens: 150,
      system: "You are a helpful assistant that creates concise document summaries.",
      messages: [
        {
          role: "user",
          content: `Create a 1-2 sentence summary of what this document is about. Focus on the main topics and concepts that would be relevant for creating an index. Here's the text: ${text.substring(0, 3000)}`
        }
      ]
    });

    // Extract the response content
    let summary = '';
    if (Array.isArray(response.content)) {
      for (const contentBlock of response.content) {
        if (contentBlock.type === 'text') {
          summary = contentBlock.text;
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error generating document summary:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}