'use client'
import React, { useState, useRef, useEffect } from 'react'
import mammoth from 'mammoth'
import {
  mergeIndexEntries,
  determineProcessingStrategy,
  calculateChunkParameters,
} from './indexProcessing'
import IndexEntry from '@/utils/indexEntry'
import Steps from '@/components/Steps'
import UploadStep from './UploadStep'
import ConfigureStep, { audienceLevels, indexDensities } from './ConfigureStep'
import SuccessPopup from './SuccessPopup'
import UploadSuccessMessage from './UploadSuccess'
import secondPass from './secondPass'
import CompletedIndexView from './CompletedIndexView'

/**
 * Tracks the current status of document processing.
 */
export interface ProcessingStatus {
  currentChunk: number
  totalChunks: number
  entriesGenerated: number
  status: 'idle' | 'processing' | 'merging' | 'complete' | 'error'
  error?: string
  progress: number
}

export default function IndexGenerator() {
  const [file, setFile] = useState<File | null>(null)
  const [documentPageCount, setDocumentPageCount] = useState<number>(0)
  const [indexEntries, setIndexEntries] = useState<IndexEntry[]>([])
  const [exampleIndex, setExampleIndex] = useState<string>('')
  const [showExampleInput, setShowExampleInput] = useState<boolean>(false)
  const [audienceLevel, setAudienceLevel] = useState<0 | 1 | 2>(1) // 0=high school, 1=undergraduate, 2=graduate
  const [indexDensity, setIndexDensity] = useState<0 | 1 | 2>(1) // 0=broad, 1=medium, 2=detailed
  const [targetAudience, setTargetAudience] = useState<string>('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [specialInstructions, setSpecialInstructions] = useState<string>('')
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    currentChunk: 0,
    totalChunks: 0,
    entriesGenerated: 0,
    status: 'idle',
    progress: 0,
  })
  const [showUploadSuccess, setShowUploadSuccess] = useState(false)

  // This uses the AbortController Web API to allow cancellation of ongoing web requests
  const abortControllerRef = useRef<AbortController | null>(null)

  const [currentStep, setCurrentStep] = useState<0 | 1 | 2>(0)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.name.endsWith('.docx')) {
        setFile(selectedFile)
        setShowUploadSuccess(true)
        setCurrentStep(1)
        setTimeout(() => setShowUploadSuccess(false), 2000)
      }
    }
  }

  // TODO refactor this and processWithChunking into separate modules like I did with secondPass
  /**
   * Utility function to generate index entries when we're using the single-pass approach.
   * processDocument uses this function.
   *
   * @param text The full text of the document to process.
   * @param documentSummary A brief summary of the document content to provide context.
   * @return The list of index entries generated from the entire document.
   */
  const processSinglePass = async (
    text: string,
    documentSummary: string,
  ): Promise<IndexEntry[]> => {
    setProcessingStatus((prev) => ({
      ...prev,
      totalChunks: 1,
      status: 'processing',
      currentChunk: 1,
      progress: 25,
    }))

    console.log(
      `Processing entire document (${text.length} characters) in single pass...`,
    )

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 360000) // 6 minutes

      const response = await fetch('/api/generate-index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chunk: text, // Send entire document
          chunkIndex: 0,
          totalChunks: 1,
          totalPages: documentPageCount,
          pageRange: { start: 1, end: documentPageCount },
          previousEntries: [], // No previous entries needed
          exampleIndex: showExampleInput ? exampleIndex : '',
          isSecondPass: false,
          documentSummary: documentSummary,
          // Convert numeric audience level to string
          audienceLevel: audienceLevels[audienceLevel],
          // Convert numeric index density to string
          indexDensity: indexDensities[indexDensity],
          targetAudience: targetAudience,
          specialInstructions: specialInstructions,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Single-pass API error:', errorData)
        throw new Error(
          typeof errorData === 'object' && errorData?.error
            ? errorData.error
            : 'Failed to process document in single pass',
        )
      }

      const data = await response.json()

      if (data.entries && Array.isArray(data.entries)) {
        console.log(`✅ Single-pass generated ${data.entries.length} entries`)
        setIndexEntries(data.entries)
        setProcessingStatus((prev) => ({
          ...prev,
          entriesGenerated: data.entries.length,
          progress: 50,
        }))
        return data.entries
      } else {
        console.warn('No entries received from single-pass:', data)
        return []
      }
    } catch (error) {
      console.error('Single-pass processing error:', error)
      throw error
    }
  }

  /**
   * Utility function to generate index entries using the traditional chunking approach.
   * processDocument uses this function.
   *
   * @param text The full text of the document to process.
   * @param documentSummary A brief summary of the document content to provide context.
   * @return The complete list of index entries generated from all chunks.
   */
  const processWithChunking = async (
    text: string,
    documentSummary: string,
  ): Promise<IndexEntry[]> => {
    // Calculate chunk parameters using utility function
    const { chunkSize, overlapSize, totalChunks } = calculateChunkParameters(
      text.length,
    )
    const effectiveChunkSize = chunkSize - overlapSize

    console.log(
      `📑 Dividing document into ${totalChunks} chunks with ${overlapSize} character overlap`,
    )
    console.log(
      `📏 Document: ${text.length} chars, effective chunk size: ${effectiveChunkSize} chars`,
    )

    setProcessingStatus((prev) => ({
      ...prev,
      totalChunks: totalChunks,
      status: 'processing',
    }))

    // Process each chunk and accumulate entries
    let allChunkEntries: IndexEntry[] = []

    for (let i = 0; i < totalChunks; i++) {
      // Calculate chunk boundaries with overlap
      const startChar = i === 0 ? 0 : i * effectiveChunkSize
      const endChar = Math.min(startChar + chunkSize, text.length)
      const chunkText = text.substring(startChar, endChar)

      // Estimate page ranges for this chunk
      const startPage = Math.max(
        1,
        Math.floor((startChar / text.length) * documentPageCount),
      )
      const endPage = Math.min(
        documentPageCount,
        Math.ceil((endChar / text.length) * documentPageCount),
      )

      console.log(`🔍 Processing chunk ${i + 1}/${totalChunks}:`)
      console.log(
        `   📍 Characters: ${startChar} - ${endChar} (${chunkText.length} chars)`,
      )
      console.log(`   📄 Estimated pages: ${startPage} - ${endPage}`)
      if (i > 0) {
        console.log(`   🔄 Overlap with previous chunk: ${overlapSize} chars`)
      }

      setProcessingStatus((prev) => ({
        ...prev,
        currentChunk: i + 1,
        progress: Math.floor((i / totalChunks) * 50), // First pass goes up to 50%
      }))

      try {
        const response = await fetch('/api/generate-index', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chunk: chunkText,
            chunkIndex: i,
            totalChunks: totalChunks,
            totalPages: documentPageCount,
            pageRange: { start: startPage, end: endPage },
            previousEntries: allChunkEntries, // Pass previous entries for context
            exampleIndex: showExampleInput ? exampleIndex : '',
            isSecondPass: false,
            documentSummary: documentSummary,
            audienceLevel:
              audienceLevel === 0
                ? 'high_school'
                : audienceLevel === 1
                  ? 'undergraduate'
                  : 'graduate',
            indexDensity:
              indexDensity === 0
                ? 'broad'
                : indexDensity === 1
                  ? 'medium'
                  : 'detailed',
            targetAudience: targetAudience,
            specialInstructions: specialInstructions,
          }),
          signal: abortControllerRef.current?.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error(`Chunk ${i + 1} API error:`, errorData)
          throw new Error(
            typeof errorData === 'object' && errorData?.error
              ? errorData.error
              : `Failed to process chunk ${i + 1}`,
          )
        }

        const data = await response.json()

        if (data.entries && Array.isArray(data.entries)) {
          console.log(
            `✅ Chunk ${i + 1} generated ${data.entries.length} entries`,
          )

          // Merge with existing entries
          allChunkEntries = mergeIndexEntries(allChunkEntries, data.entries)

          setProcessingStatus((prev) => ({
            ...prev,
            entriesGenerated: allChunkEntries.length,
          }))
        } else {
          console.warn(`No entries received from chunk ${i + 1}:`, data)
        }
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error)
        throw error
      }
    }

    return allChunkEntries
  }

  /**
   * Error handler for the processDocument function.
   * @param error
   */
  function handleErrorWhileProcessing(error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      setProcessingStatus((prev) => ({
        ...prev,
        status: 'idle',
        error: 'Processing was cancelled',
      }))
    } else {
      console.error('Error processing document:', error)

      // Check if we have any partial results
      if (indexEntries.length > 0) {
        console.log(
          `Saving ${indexEntries.length} entries that were generated before the error`,
        )
        setProcessingStatus((prev) => ({
          ...prev,
          status: 'complete',
          progress: 100,
          error: `Completed with partial results. Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`,
        }))
      } else {
        setProcessingStatus((prev) => ({
          ...prev,
          status: 'error',
          error:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred',
        }))
      }
    }
  }

  /**
   * Main function to process the document and generate index entries. This runs after the user
   * clicks the "Generate Index" button in the configuration step.
   */
  const processDocument = async () => {
    // This is impossible to reach due to UI constraints, but checking helps with TypeScript
    if (!file || !documentPageCount || documentPageCount <= 0) {
      setProcessingStatus({
        ...processingStatus,
        status: 'error',
        error: 'Please select a file and enter the page count',
      })
      return
    }

    try {
      // Reset abort controller if it's already running
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      // Reset status
      setProcessingStatus({
        currentChunk: 0,
        totalChunks: 0,
        entriesGenerated: 0,
        status: 'processing',
        progress: 0,
      })
      setIndexEntries([])
      // Move to the generating step
      setCurrentStep(2)

      console.log('Extracting text from DOCX...')

      // Extract text from DOCX using a package called Mammoth.
      // Remember that we haven't actually uploaded the file anywhere—it's all client-side.
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({
        arrayBuffer: arrayBuffer,
      })

      const fullText = result.value
      console.log(`Total extracted text length: ${fullText.length} characters`)

      if (fullText.length < 1000) {
        console.warn(
          'Extracted text seems unusually short. Check document parsing.',
        )
        setProcessingStatus({
          ...processingStatus,
          status: 'error',
          error:
            'Extracted text is too short. Please check the document format.',
        })
        return
      }

      let rawEntries: IndexEntry[] = []
      let documentSummary = ''

      // Determine processing approach using utility function
      const useSinglePass = determineProcessingStrategy(
        documentPageCount,
        fullText.length,
      )
      console.log(
        `📊 Document analysis: ${documentPageCount} pages, ${fullText.length} characters`,
      )
      console.log(
        `🚀 Processing approach: ${useSinglePass ? 'SINGLE-PASS (full context)' : 'CHUNKING (traditional)'}`,
      )

      if (useSinglePass) {
        rawEntries = await processSinglePass(fullText, documentSummary)
      } else {
        rawEntries = await processWithChunking(fullText, documentSummary)
      }

      // SECOND PASS: Refine the complete set of entries
      setProcessingStatus((prev) => ({
        ...prev,
        status: 'merging',
        // Show the user progress is at 75% when we start the second pass
        progress: 75,
      }))

      // TODO design this better so we don't have to pass so many parameters
      const secondPassRes = await secondPass(
        rawEntries,
        documentSummary,
        abortControllerRef as React.RefObject<AbortController>,
        documentPageCount,
        audienceLevel,
        indexDensity,
        targetAudience,
        specialInstructions,
        showExampleInput,
        exampleIndex,
      )

      // Logic to handle the result of the second pass
      if (secondPassRes.result === 'success') {
        // Abort if no entries were generated
        if (secondPassRes.entries.length === 0) {
          setProcessingStatus((prev) => ({
            ...prev,
            status: 'error',
            error:
              secondPassRes.message ||
              'No index entries could be generated. Try using a smaller document.',
          }))
        } else {
          setIndexEntries(secondPassRes.entries)

          if (!secondPassRes.message) {
            // This is the best result: everything worked according to plan
            setProcessingStatus((prev) => ({
              ...prev,
              status: 'complete',
              progress: 100,
            }))
            setShowSuccessPopup(true) // Show the success popup
            setTimeout(() => setShowSuccessPopup(false), 4000) // Hide after 4 seconds
          } else {
            // If we have a message, it indicates a warning or partial success
            setProcessingStatus((prev) => ({
              ...prev,
              status: 'complete',
              progress: 100,
              error: secondPassRes.message,
            }))
          }
        }
      } else {
        // Second pass failed
        setProcessingStatus((prev) => ({
          ...prev,
          status: 'error',
          error: secondPassRes.message,
        }))
      }
    } catch (error) {
      handleErrorWhileProcessing(error)
    }
  }

  /**
   * User clicked the "Cancel" button while processing the document.
   */
  const cancelProcessing = () => {
    // Cancel any ongoing web requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    setProcessingStatus((prev) => ({
      ...prev,
      status: 'idle',
      error: 'Processing was cancelled by user',
    }))
  }

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full text-center max-w-5xl">
        <div className="text-center w-full mb-8">
          <h1 className="verification-title mb-4 font-serif text-gray-800 animate-fade-in">
            Create a professional index for your book.
          </h1>
          <p className="text-gray-600 font-sans animate-fade-in-delay-1 opacity-0">
            Upload your document, set your preferences, and let Tandem do the
            rest.
          </p>
        </div>

        <Steps
          steps={[
            { name: 'Upload', description: 'Upload your document' },
            { name: 'Configure', description: 'Set parameters' },
            { name: 'Generate', description: 'Create your index' },
          ]}
          currentStep={currentStep}
        />

        {currentStep === 0 && (
          <UploadStep
            file={file}
            onFileChange={handleFileChange}
            error={processingStatus.error}
          />
        )}

        {currentStep === 1 && (
          // TODO use a React form component library for better handling of state. All these state
          // values should be on ConfigureStep and then when submitted the results be passed to this component.
          <ConfigureStep
            documentPageCount={documentPageCount}
            setDocumentPageCount={setDocumentPageCount}
            audienceLevel={audienceLevel}
            setAudienceLevel={setAudienceLevel}
            indexDensity={indexDensity}
            setIndexDensity={setIndexDensity}
            targetAudience={targetAudience}
            setTargetAudience={setTargetAudience}
            specialInstructions={specialInstructions}
            setSpecialInstructions={setSpecialInstructions}
            showExampleInput={showExampleInput}
            setShowExampleInput={setShowExampleInput}
            exampleIndex={exampleIndex}
            setExampleIndex={setExampleIndex}
            onSubmit={processDocument}
          />
        )}

        {(processingStatus.status === 'processing' ||
          processingStatus.status === 'merging') && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-sans text-gray-800 mb-4">
              {processingStatus.status === 'processing'
                ? `Generating Index -- Processing Chunk ${processingStatus.currentChunk} of ${processingStatus.totalChunks}...`
                : 'Completing Index...'}
            </h2>

            <div className="relative pt-1">
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-200">
                <div
                  style={{ width: `${processingStatus.progress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-mint transition-all duration-500"
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>{processingStatus.progress}% Complete</span>
                <span>
                  {processingStatus.entriesGenerated} Entries Generated
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                onClick={cancelProcessing}
                className="py-2 px-4 rounded-lg text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors focus:outline-none"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {processingStatus.status === 'error' && (
          <div className="bg-red-50 p-6 rounded-lg shadow-md mb-6 border border-red-200">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{processingStatus.error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full py-2 px-4 rounded-lg text-white font-medium bg-darkRed hover:bg-red-700 transition-colors focus:outline-none"
            >
              Try Again
            </button>
          </div>
        )}

        {processingStatus.status === 'complete' && (
          <CompletedIndexView
            entries={indexEntries}
            processingStatus={processingStatus}
            onAdjustSettings={() => {
              setCurrentStep(1)
              setProcessingStatus({
                currentChunk: 0,
                totalChunks: 0,
                entriesGenerated: 0,
                status: 'idle',
                progress: 0,
              })
            }}
          />
        )}

        {/* Show upload success message */}
        {showUploadSuccess && <UploadSuccessMessage />}
      </div>

      {showSuccessPopup && <SuccessPopup />}
    </div>
  )
}
