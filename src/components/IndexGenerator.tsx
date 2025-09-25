'use client'
import React, { useState, useRef, useEffect } from 'react'
import mammoth from 'mammoth'
import {
  IndexEntry,
  extractPageNumbers,
  mergeIndexEntries,
  determineProcessingStrategy,
  calculateChunkParameters,
} from '@/utils/indexProcessing'
import { formatPageRanges } from '@/utils/indexingPrompts'

interface ProcessingStatus {
  currentChunk: number
  totalChunks: number
  entriesGenerated: number
  status: 'idle' | 'processing' | 'merging' | 'complete' | 'error'
  error?: string
  progress: number
}

const IndexGenerator = (): React.ReactElement => {
  const [file, setFile] = useState<File | null>(null)
  const [documentPageCount, setDocumentPageCount] = useState<number>(0)
  const [indexEntries, setIndexEntries] = useState<IndexEntry[]>([])
  const [exampleIndex, setExampleIndex] = useState<string>('')
  const [showExampleInput, setShowExampleInput] = useState<boolean>(false)
  const [audienceLevel, setAudienceLevel] = useState<number>(1) // 0=high school, 1=undergraduate, 2=graduate
  const [indexDensity, setIndexDensity] = useState<number>(1) // 0=broad, 1=medium, 2=detailed
  const [targetAudience, setTargetAudience] = useState<string>('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [sortMethod, setSortMethod] = useState<'alphabetical' | 'pageNumber'>(
    'alphabetical',
  )
  const [specialInstructions, setSpecialInstructions] = useState<string>('')
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    currentChunk: 0,
    totalChunks: 0,
    entriesGenerated: 0,
    status: 'idle',
    progress: 0,
  })
  const [showUploadSuccess, setShowUploadSuccess] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Define steps for the process
  const steps = [
    { name: 'Upload', description: 'Upload your document' },
    { name: 'Configure', description: 'Set parameters' },
    { name: 'Generate', description: 'Create your index' },
  ]

  const [currentStep, setCurrentStep] = useState(0)

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

  // Use utility function for extracting page numbers

  const processDocument = async () => {
    if (!file || !documentPageCount || documentPageCount <= 0) {
      setProcessingStatus({
        ...processingStatus,
        status: 'error',
        error: 'Please select a file and enter the page count',
      })
      return
    }

    // Use utility function for merging entries

    try {
      // Reset abort controller
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
      setCurrentStep(2)

      console.log('Extracting text from DOCX...')

      // Extract text from DOCX
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

      let allEntries: IndexEntry[] = []
      let documentSummary = ''

      // Helper function for single-pass processing
      const processSinglePass = async (text: string): Promise<IndexEntry[]> => {
        setProcessingStatus((prev) => ({
          ...prev,
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
            console.log(
              `✅ Single-pass generated ${data.entries.length} entries`,
            )
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

      // Helper function for chunking processing
      const processWithChunking = async (
        text: string,
      ): Promise<IndexEntry[]> => {
        // Calculate chunk parameters using utility function
        const { chunkSize, overlapSize, totalChunks } =
          calculateChunkParameters(text.length)
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
            console.log(
              `   🔄 Overlap with previous chunk: ${overlapSize} chars`,
            )
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

      if (useSinglePass) {
        // SINGLE-PASS PROCESSING: Process entire document at once
        console.log('Using single-pass processing for optimal accuracy...')

        setProcessingStatus((prev) => ({
          ...prev,
          totalChunks: 1,
          status: 'processing',
        }))

        allEntries = await processSinglePass(fullText)
      } else {
        // CHUNKING PROCESSING: Use traditional approach for large documents
        console.log('📚 Using chunking approach for large document...')
        allEntries = await processWithChunking(fullText)
      }

      // SECOND PASS: Refine the complete set of entries
      setProcessingStatus((prev) => ({
        ...prev,
        status: 'merging',
        progress: 75, // Start second pass progress at 75%
      }))

      // Skip second pass if no entries were generated
      if (allEntries.length === 0) {
        setProcessingStatus((prev) => ({
          ...prev,
          status: 'error',
          error:
            'No index entries could be generated. Try using a smaller document or checking the console for errors.',
        }))
        return
      }

      try {
        console.log(
          `Starting second pass with ${allEntries.length} raw entries...`,
        )

        const refinementResponse = await fetch('/api/generate-index', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isSecondPass: true,
            allEntries,
            totalPages: documentPageCount,
            exampleIndex: showExampleInput ? exampleIndex : '',
            documentSummary,
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
          signal: abortControllerRef.current.signal,
        })

        if (!refinementResponse.ok) {
          const errorData = await refinementResponse.json()
          console.error('Refinement API error:', errorData)
          throw new Error(
            typeof errorData === 'object' && errorData?.error
              ? errorData.error
              : 'Failed to refine index',
          )
        }

        const refinedData = await refinementResponse.json()

        if (refinedData.warning) {
          console.warn('Refinement warning:', refinedData.warning)
        }

        if (refinedData.entries && Array.isArray(refinedData.entries)) {
          console.log(`Received ${refinedData.entries.length} refined entries`)

          // Use the refined entries
          setIndexEntries(refinedData.entries)
          setProcessingStatus((prev) => ({
            ...prev,
            entriesGenerated: refinedData.entries.length,
            status: 'complete',
            progress: 100,
          }))
          setShowSuccessPopup(true) // Show the success popup
          setTimeout(() => setShowSuccessPopup(false), 4000) // Hide after 4 seconds
        } else {
          console.error('Invalid refined entries:', refinedData)
          throw new Error('Refinement did not return valid entries')
        }
      } catch (refinementError) {
        console.error('Error during refinement phase:', refinementError)

        // If we have entries from the first pass, use them as a fallback
        if (allEntries.length > 0) {
          console.log(
            `Using ${allEntries.length} entries from first pass due to refinement error`,
          )

          // Filter, sort, and present the entries from the first pass
          const filteredEntries = allEntries.filter(
            (entry) =>
              entry &&
              entry.term &&
              entry.term.trim() !== '' &&
              entry.term.toLowerCase() !== 'undefined' &&
              entry.term.toLowerCase() !== 'unknown term',
          )

          // Sort entries alphabetically
          filteredEntries.sort((a, b) => {
            if (!a.term) return 1
            if (!b.term) return -1
            return a.term.localeCompare(b.term)
          })

          // For each entry, sort its subentries
          filteredEntries.forEach((entry) => {
            if (entry.subentries && entry.subentries.length > 0) {
              entry.subentries.sort((a, b) => a.term.localeCompare(b.term))
            }
          })

          setIndexEntries(filteredEntries)
          setProcessingStatus((prev) => ({
            ...prev,
            status: 'complete',
            progress: 100,
            error: `Completed with first pass results only. Refinement error: ${refinementError instanceof Error ? refinementError.message : 'An unexpected error occurred'}`,
          }))
        } else {
          // If we don't have any entries, show an error
          setProcessingStatus((prev) => ({
            ...prev,
            status: 'error',
            error:
              refinementError instanceof Error
                ? refinementError.message
                : 'An unexpected error occurred during index refinement',
          }))
        }
      }
    } catch (error) {
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
  }

  const cancelProcessing = () => {
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

  // Format index entries for display
  const formatIndexEntries = () => {
    if (sortMethod === 'pageNumber') {
      return formatIndexEntriesByPageNumber()
    }

    return indexEntries.map((entry, index) => (
      <div key={index} className="mb-2">
        <div className="flex">
          <div className="flex-grow font-medium">{entry.term}</div>
          <div className="text-gray-600">{entry.pageNumbers}</div>
        </div>
        {entry.subentries && entry.subentries.length > 0 && (
          <div className="pl-6">
            {entry.subentries.map((subentry, subIndex) => (
              <div key={`${index}-${subIndex}`} className="flex">
                <div className="flex-grow">- {subentry.term}</div>
                <div className="text-gray-600">{subentry.pageNumbers}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    ))
  }

  // Format index entries sorted by page number
  const formatIndexEntriesByPageNumber = () => {
    // Create a flattened list of all entries with their page numbers
    const flattenedEntries: Array<{
      displayText: string
      pageNumbers: string
      numericPages: number[]
    }> = []

    indexEntries.forEach((entry) => {
      // Add main entry if it has page numbers
      if (entry.pageNumbers && entry.pageNumbers.trim() !== '') {
        const numericPages = extractPageNumbers(entry.pageNumbers).filter(
          (p) => typeof p === 'number',
        ) as number[]

        if (numericPages.length > 0) {
          flattenedEntries.push({
            displayText: entry.term,
            pageNumbers: entry.pageNumbers,
            numericPages: numericPages,
          })
        }
      }

      // Add subentries
      if (entry.subentries && entry.subentries.length > 0) {
        entry.subentries.forEach((subentry) => {
          if (subentry.pageNumbers && subentry.pageNumbers.trim() !== '') {
            const numericPages = extractPageNumbers(
              subentry.pageNumbers,
            ).filter((p) => typeof p === 'number') as number[]

            if (numericPages.length > 0) {
              flattenedEntries.push({
                displayText: `${entry.term} > ${subentry.term}`,
                pageNumbers: subentry.pageNumbers,
                numericPages: numericPages,
              })
            }
          }
        })
      }
    })

    // Sort by the first page number of each entry
    flattenedEntries.sort((a, b) => {
      const aFirstPage = Math.min(...a.numericPages)
      const bFirstPage = Math.min(...b.numericPages)
      return aFirstPage - bFirstPage
    })

    return flattenedEntries.map((entry, index) => (
      <div key={index} className="mb-2">
        <div className="flex">
          <div className="flex-grow font-medium">{entry.displayText}</div>
          <div className="text-gray-600">{entry.pageNumbers}</div>
        </div>
      </div>
    ))
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full text-center max-w-5xl">
        <div className="text-center w-full mb-8 fade-in">
          <h1 className="verification-title mb-4 leading-snug font-serif text-gray-800">
            Create a professional index for your book.
          </h1>
          <p className="text-gray-600 font-sans fade-in-delay-1">
            Upload your document, set your preferences, and let Tandem do the
            rest.
          </p>
        </div>

        <div className="mb-8 w-full">
          {/* Step Indicators */}
          <div className="flex justify-between max-w-xl mx-auto mb-2">
            {steps.map((step, index) => (
              <div
                key={`indicator-${index}`}
                className="w-1/3 flex items-center"
              >
                {index > 0 && (
                  <div
                    className={`h-0.5 flex-grow ${index <= currentStep ? 'bg-mint' : 'bg-gray-200'}`}
                  />
                )}
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
                    index < currentStep
                      ? 'bg-mint'
                      : index === currentStep
                        ? 'border-2 border-mint bg-white'
                        : 'border-2 border-gray-200 bg-white'
                  }`}
                >
                  <span
                    className={`${index < currentStep ? 'text-white' : index === currentStep ? 'text-mint' : 'text-gray-500'}`}
                  >
                    {index + 1}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-grow ${index < currentStep ? 'bg-mint' : 'bg-gray-200'}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step Texts - separate but with matching widths */}
          <div className="flex justify-between max-w-3xl mx-auto mb-2">
            {steps.map((step, index) => (
              <div key={`text-${index}`} className="w-1/3 text-center">
                <div
                  className={`text-sm font-medium ${index <= currentStep ? 'text-mint' : 'text-gray-500'}`}
                >
                  {step.name}
                </div>
                <div className="text-xs text-gray-500">{step.description}</div>
              </div>
            ))}
          </div>
        </div>

        {currentStep === 0 && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="mb-6">
              <label
                htmlFor="document-upload"
                className="block w-full cursor-pointer text-center p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
              >
                <div className="flex flex-col items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 text-gray-400 mb-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  {file ? (
                    <p className="text-gray-700 font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-gray-700 font-medium">
                        Upload your document
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        Choose a .docx file
                      </p>
                    </>
                  )}
                </div>
                <input
                  id="document-upload"
                  name="document"
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {processingStatus.error && (
                <p className="text-red-500 text-sm mt-2">
                  {processingStatus.error}
                </p>
              )}
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Configure Index Generation
            </h2>

            <div className="mb-8 text-left">
              <label
                htmlFor="page-count"
                className="block text-gray-700 text-lg font-medium mb-2"
              >
                Number of Pages in Document
              </label>
              <input
                id="page-count"
                type="number"
                min="1"
                value={documentPageCount || ''}
                onChange={(e) =>
                  setDocumentPageCount(parseInt(e.target.value) || 0)
                }
                className="w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Pages"
              />
              <p className="text-gray-500 text-sm mt-1">
                This helps generate accurate page numbers for the index.
              </p>
            </div>

            <div className="mb-8 text-left">
              <label
                htmlFor="audience-level"
                className="block text-gray-700 text-lg font-medium mb-4"
              >
                Audience Level
              </label>
              <div className="flex flex-col w-96">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500 text-sm">High School</span>
                  <span className="text-gray-500 text-sm">Undergraduate</span>
                  <span className="text-gray-500 text-sm">Graduate</span>
                </div>
                <input
                  id="audience-level"
                  type="range"
                  min="0"
                  max="2"
                  step="1"
                  value={audienceLevel}
                  onChange={(e) => setAudienceLevel(parseInt(e.target.value))}
                  className="w-96 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <p className="text-gray-500 text-sm mt-4">
                Select the approximate audience level for your index.
              </p>
            </div>

            <div className="mb-8 text-left">
              <label
                htmlFor="index-density"
                className="block text-gray-700 text-lg font-medium mb-4"
              >
                Index Density
              </label>
              <div className="flex flex-col w-96">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500 text-sm">Broad</span>
                  <span className="text-gray-500 text-sm">Medium</span>
                  <span className="text-gray-500 text-sm">Detailed</span>
                </div>
                <input
                  id="index-density"
                  type="range"
                  min="0"
                  max="2"
                  step="1"
                  value={indexDensity}
                  onChange={(e) => setIndexDensity(parseInt(e.target.value))}
                  className="w-96 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <p className="text-gray-500 text-sm mt-4">
                Select how detailed you want your index to be.
              </p>
            </div>

            <div className="mb-6 text-left">
              <label
                htmlFor="target-audience"
                className="block text-gray-700 text-lg font-medium mb-2"
              >
                Target Audience Description
              </label>
              <textarea
                id="target-audience"
                rows={3}
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Describe your book's target audience in a few sentences..."
              />
              <p className="text-gray-500 text-sm mt-1">
                Helps Tandem tailor the index to your specific audience.
              </p>
            </div>

            <div className="mb-8 text-left">
              <div className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded-r-lg mb-4">
                <label
                  htmlFor="special-instructions"
                  className="block text-gray-800 text-lg font-semibold mb-2"
                >
                  ⚡ Special Instructions (Override All Other Settings)
                </label>
                <textarea
                  id="special-instructions"
                  rows={4}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-orange-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter any special instructions that should override all other settings. For example: 'Focus on technical terms only', 'Include all proper nouns', 'Use Chicago Manual of Style formatting', etc."
                />
                <p className="text-orange-700 text-sm mt-2 font-medium">
                  ⚠️ These instructions will override all other settings above.
                  Use this for specific requirements that take priority.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center mb-2">
                <input
                  id="use-example"
                  type="checkbox"
                  checked={showExampleInput}
                  onChange={(e) => setShowExampleInput(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="use-example"
                  className="ml-2 text-lg block text-gray-700 font-medium"
                >
                  Use an Example Index for Style Reference (Optional)
                </label>
              </div>
              <p className="text-gray-500 text-sm mb-2">
                Providing an example index will help Tandem follow a specific
                style.
              </p>

              {showExampleInput && (
                <textarea
                  id="example-index"
                  rows={6}
                  value={exampleIndex}
                  onChange={(e) => setExampleIndex(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Paste an example index here to guide the style and format..."
                />
              )}
            </div>

            <button
              onClick={processDocument}
              disabled={!documentPageCount || documentPageCount <= 0}
              className={`w-fit py-3 px-4 rounded-lg text-white font-medium ${
                !documentPageCount || documentPageCount <= 0
                  ? 'bg-lightRed'
                  : 'bg-darkRed hover:bg-darkRed'
              } transition-colors focus:outline-none focus:ring-2 focus:ring-darkRed focus:ring-offset-2`}
            >
              Generate Index
            </button>
          </div>
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
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Your Index
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="sort-method"
                    className="text-sm font-medium text-gray-700"
                  >
                    Sort by:
                  </label>
                  <select
                    id="sort-method"
                    value={sortMethod}
                    onChange={(e) =>
                      setSortMethod(
                        e.target.value as 'alphabetical' | 'pageNumber',
                      )
                    }
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="alphabetical">Alphabetical</option>
                    <option value="pageNumber">Page Number</option>
                  </select>
                </div>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                  {indexEntries.length} Main Entries
                </span>
              </div>
            </div>

            {processingStatus.error && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  {processingStatus.error}
                </p>
              </div>
            )}

            <div className="h-96 text-left overflow-y-auto border border-gray-200 rounded p-4 mb-4 font-serif">
              {formatIndexEntries()}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => {
                  setCurrentStep(1)
                  setProcessingStatus({
                    currentChunk: 0,
                    totalChunks: 0,
                    entriesGenerated: 0,
                    status: 'idle',
                    progress: 0,
                  })
                }}
                className="py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none"
              >
                Adjust Settings
              </button>

              <button
                onClick={() => {
                  // Download as text file based on current sort method
                  let content = ''

                  if (sortMethod === 'pageNumber') {
                    // Create flattened entries for page number sorting
                    const flattenedEntries: Array<{
                      displayText: string
                      pageNumbers: string
                      numericPages: number[]
                    }> = []

                    indexEntries.forEach((entry) => {
                      // Add main entry if it has page numbers
                      if (
                        entry.pageNumbers &&
                        entry.pageNumbers.trim() !== ''
                      ) {
                        const numericPages = extractPageNumbers(
                          entry.pageNumbers,
                        ).filter((p) => typeof p === 'number') as number[]

                        if (numericPages.length > 0) {
                          flattenedEntries.push({
                            displayText: entry.term,
                            pageNumbers: entry.pageNumbers,
                            numericPages: numericPages,
                          })
                        }
                      }

                      // Add subentries
                      if (entry.subentries && entry.subentries.length > 0) {
                        entry.subentries.forEach((subentry) => {
                          if (
                            subentry.pageNumbers &&
                            subentry.pageNumbers.trim() !== ''
                          ) {
                            const numericPages = extractPageNumbers(
                              subentry.pageNumbers,
                            ).filter((p) => typeof p === 'number') as number[]

                            if (numericPages.length > 0) {
                              flattenedEntries.push({
                                displayText: `${entry.term} > ${subentry.term}`,
                                pageNumbers: subentry.pageNumbers,
                                numericPages: numericPages,
                              })
                            }
                          }
                        })
                      }
                    })

                    // Sort by the first page number of each entry
                    flattenedEntries.sort((a, b) => {
                      const aFirstPage = Math.min(...a.numericPages)
                      const bFirstPage = Math.min(...b.numericPages)
                      return aFirstPage - bFirstPage
                    })

                    content = flattenedEntries
                      .map(
                        (entry) => `${entry.displayText}, ${entry.pageNumbers}`,
                      )
                      .join('\n')
                  } else {
                    // Traditional alphabetical format
                    content = indexEntries
                      .map((entry) => {
                        let text = `${entry.term}, ${entry.pageNumbers}`
                        if (entry.subentries && entry.subentries.length > 0) {
                          text +=
                            '\n' +
                            entry.subentries
                              .map(
                                (sub) => `  - ${sub.term}, ${sub.pageNumbers}`,
                              )
                              .join('\n')
                        }
                        return text
                      })
                      .join('\n\n')
                  }

                  const blob = new Blob([content], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `book-index-${sortMethod}.txt`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                }}
                className="py-2 px-4 bg-darkRed text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none"
              >
                Download Index
              </button>
            </div>
          </div>
        )}

        {/* Show upload success message */}
        {showUploadSuccess && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-lg shadow-lg">
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 mb-4 relative">
                  {/* Replace with improved SVG */}
                  <svg className="animate-book-open" viewBox="0 0 100 100">
                    {/* Book cover */}
                    <rect
                      x="15"
                      y="25"
                      width="70"
                      height="55"
                      rx="2"
                      fill="#B54646"
                      className="book-cover"
                    />

                    {/* Book spine */}
                    <rect x="15" y="25" width="5" height="55" fill="#933a3a" />

                    {/* Pages - these animate to open */}
                    <path
                      className="book-left-page"
                      d="M20,30 L20,75 Q20,80 25,80 L50,80 L50,30 Z"
                      fill="#f8f8f8"
                    />
                    <path
                      className="book-right-page"
                      d="M80,30 L80,75 Q80,80 75,80 L50,80 L50,30 Z"
                      fill="#f8f8f8"
                    />

                    {/* Page details - lines of text */}
                    <g className="book-lines">
                      <line
                        x1="25"
                        y1="40"
                        x2="45"
                        y2="40"
                        stroke="#ddd"
                        strokeWidth="1"
                      />
                      <line
                        x1="25"
                        y1="45"
                        x2="45"
                        y2="45"
                        stroke="#ddd"
                        strokeWidth="1"
                      />
                      <line
                        x1="25"
                        y1="50"
                        x2="40"
                        y2="50"
                        stroke="#ddd"
                        strokeWidth="1"
                      />
                      <line
                        x1="55"
                        y1="40"
                        x2="75"
                        y2="40"
                        stroke="#ddd"
                        strokeWidth="1"
                      />
                      <line
                        x1="55"
                        y1="45"
                        x2="75"
                        y2="45"
                        stroke="#ddd"
                        strokeWidth="1"
                      />
                      <line
                        x1="55"
                        y1="50"
                        x2="70"
                        y2="50"
                        stroke="#ddd"
                        strokeWidth="1"
                      />
                    </g>

                    {/* Book title box */}
                    <rect
                      x="25"
                      y="15"
                      width="50"
                      height="10"
                      rx="2"
                      fill="#5EA89B"
                      className="book-title"
                    />
                  </svg>
                </div>
                <p className="text-darkRed font-medium text-xl">
                  File Uploaded!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white/80 backdrop-blur-lg p-8 rounded-lg shadow-float animate-bounce-in">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 mb-4 bg-mint rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-navy font-medium text-2xl mb-2">
                I've created the first draft of your index!
              </p>
              <p className="text-gray-600 text-sm">
                Saving time feels nice, doesn't it?
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IndexGenerator
