import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export async function GET() {
  try {
    console.log('Testing basic Claude API connection...')

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: "Respond with just the text: 'API connection successful'",
        },
      ],
    })

    let responseText = ''
    if (Array.isArray(response.content)) {
      for (const contentBlock of response.content) {
        if (contentBlock.type === 'text') {
          responseText = contentBlock.text
          break
        }
      }
    }

    return NextResponse.json({
      success: true,
      response: responseText,
    })
  } catch (error) {
    console.error('Claude API test error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: JSON.stringify(error),
      },
      {
        status: 500,
      },
    )
  }
}
