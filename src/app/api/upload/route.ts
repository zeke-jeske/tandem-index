import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'

// In a real app, you'd want to use environment variables for this
const UPLOAD_DIR = join(process.cwd(), 'uploads')

export async function POST(request: NextRequest) {
  try {
    // Ensure the upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    // Process the uploaded file
    const formData = await request.formData()
    const file = formData.get('document') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.endsWith('.docx')) {
      return NextResponse.json(
        { error: 'Only .docx files are supported' },
        { status: 400 },
      )
    }

    // Generate a unique filename to prevent overwriting
    const uniqueId = uuidv4()
    const fileName = `${uniqueId}-${file.name}`
    const filePath = join(UPLOAD_DIR, fileName)

    // Save the file
    const fileBuffer = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(fileBuffer))

    // For a real application, here is where you would:
    // 1. Process the document with your indexing logic
    // 2. Store metadata in a database
    // 3. Queue the job for processing if it's a long-running task

    return NextResponse.json({
      success: true,
      fileId: uniqueId,
      fileName: file.name,
      message: 'File uploaded successfully',
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 },
    )
  }
}
