// src/app/api/test-claude/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function GET() {
  try {
    console.log('Testing Claude API connection...');
    
    // Try with a different model - claude-3-haiku is typically more widely available
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Hello, please respond with a simple JSON: { \"status\": \"ok\" }"
        }
      ]
    });
    
    console.log('Successfully connected to Claude API');
    
    return NextResponse.json({
      success: true,
      modelUsed: "claude-3-haiku-20240307",
      responseType: typeof response,
      responseContent: response.content,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Claude API test error:', err);
    
    return NextResponse.json({
      success: false,
      error: err.message,
      errorType: typeof err,
      errorObject: JSON.stringify(err, Object.getOwnPropertyNames(err))
    }, {
      status: 500
    });
  }
}