"use client";
import React, { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';

interface IndexEntry {
  term: string;
  pageNumbers: string;
  subentries?: {
    term: string;
    pageNumbers: string;
  }[];
}

interface ProcessingStatus {
  currentChunk: number;
  totalChunks: number;
  entriesGenerated: number;
  status: 'idle' | 'processing' | 'merging' | 'complete' | 'error';
  error?: string;
  progress: number;
}

const IndexGenerator = (): React.ReactElement => {
  const [file, setFile] = useState<File | null>(null);
  const [documentPageCount, setDocumentPageCount] = useState<number>(0);
  const [indexEntries, setIndexEntries] = useState<IndexEntry[]>([]);
  const [exampleIndex, setExampleIndex] = useState<string>('');
  const [showExampleInput, setShowExampleInput] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    currentChunk: 0,
    totalChunks: 0,
    entriesGenerated: 0,
    status: 'idle',
    progress: 0
  });
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Define steps for the process
  const steps = [
    { name: 'Upload', description: 'Upload your document' },
    { name: 'Configure', description: 'Set parameters' },
    { name: 'Generate', description: 'Create your index' }
  ];
  
  const [currentStep, setCurrentStep] = useState(0);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.docx')) {
        setFile(selectedFile);
        setShowUploadSuccess(true);
        setCurrentStep(1);
        setTimeout(() => setShowUploadSuccess(false), 2000);
      }
    }
  };
  
  // Helper function to extract page numbers from a string
  const extractPageNumbers = (pageStr: string): (number | string)[] => {
    return pageStr.split(/,\s*/).map(part => {
      // Try to parse as integer
      const num = parseInt(part.trim(), 10);
      if (!isNaN(num)) return num;
      
      // If it contains a range like "23-25", parse both numbers
      const rangeMatch = part.match(/(\d+)-(\d+)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (!isNaN(start) && !isNaN(end)) {
          // Return all numbers in the range
          return Array.from(
            { length: end - start + 1 }, 
            (_, i) => start + i
          );
        }
      }
      
      // Otherwise keep as is (for "see also" references)
      return part.trim();
    }).flat();
  };
  
  const processDocument = async () => {
    if (!file || !documentPageCount || documentPageCount <= 0) {
      setProcessingStatus({
        ...processingStatus,
        status: 'error',
        error: 'Please select a file and enter the page count'
      });
      return;
    }
    
    // Helper function to merge index entries from different chunks
    const mergeIndexEntries = (existingEntries: IndexEntry[], newEntries: IndexEntry[]): IndexEntry[] => {
      const merged = [...existingEntries];
      
      newEntries.forEach(newEntry => {
        // Check if this term already exists
        const existingIndex = merged.findIndex(e => {
          if (!e.term || !newEntry.term) return false;
          return e.term.toLowerCase() === newEntry.term.toLowerCase();
        });
        
        if (existingIndex >= 0) {
          // Merge page numbers for existing entry
          const existing = merged[existingIndex];
          const existingPages = extractPageNumbers(existing.pageNumbers);
          const newPages = extractPageNumbers(newEntry.pageNumbers);
          
          // Combine page numbers and remove duplicates
          const allPages = [...existingPages, ...newPages]
            .filter(p => p && (typeof p === 'number' || !p.toString().toLowerCase().includes('see')))
            .filter(p => typeof p === 'number' ? !isNaN(p) : true)
            .sort((a, b) => {
              if (typeof a === 'number' && typeof b === 'number') {
                return a - b;
              }
              return String(a).localeCompare(String(b));
            });
          
          // Convert back to string format
          const uniquePages = [...new Set(allPages)].map(p => String(p)).join(', ');
          
          // Handle any "see" or "see also" references
          const seeReferences = [...existingPages, ...newPages]
            .filter(p => typeof p === 'string' && p.toString().toLowerCase().includes('see'))
            .filter((p, i, arr) => arr.indexOf(p) === i); // Remove duplicates
          
          const updatedPages = uniquePages + (seeReferences.length > 0 ? 
            (uniquePages ? ', ' : '') + seeReferences.join(', ') : '');
          
          merged[existingIndex].pageNumbers = updatedPages;
          
          // Merge subentries
          if (newEntry.subentries && newEntry.subentries.length > 0) {
            if (!existing.subentries) existing.subentries = [];
            
            newEntry.subentries.forEach(newSubentry => {
              const existingSubIndex = existing.subentries!.findIndex(
                s => s.term.toLowerCase() === newSubentry.term.toLowerCase()
              );
              
              if (existingSubIndex >= 0) {
                // Merge page numbers for existing subentry
                const existingSubPages = extractPageNumbers(existing.subentries![existingSubIndex].pageNumbers);
                const newSubPages = extractPageNumbers(newSubentry.pageNumbers);
                
                // Combine page numbers and remove duplicates
                const allSubPages = [...existingSubPages, ...newSubPages]
                  .filter(p => p && (typeof p === 'number' || !p.toString().toLowerCase().includes('see')))
                  .filter(p => typeof p === 'number' ? !isNaN(p) : true)
                  .sort((a, b) => {
                    if (typeof a === 'number' && typeof b === 'number') {
                      return a - b;
                    }
                    return String(a).localeCompare(String(b));
                  });
                
                // Convert back to string format
                const uniqueSubPages = [...new Set(allSubPages)].map(p => String(p)).join(', ');
                
                // Handle any "see" or "see also" references
                const seeSubReferences = [...existingSubPages, ...newSubPages]
                  .filter(p => typeof p === 'string' && p.toString().toLowerCase().includes('see'))
                  .filter((p, i, arr) => arr.indexOf(p) === i); // Remove duplicates
                
                const updatedSubPages = uniqueSubPages + (seeSubReferences.length > 0 ? 
                  (uniqueSubPages ? ', ' : '') + seeSubReferences.join(', ') : '');
                
                existing.subentries![existingSubIndex].pageNumbers = updatedSubPages;
              } else {
                // Add new subentry
                existing.subentries!.push(newSubentry);
              }
            });
          }
        } else {
          // Add new entry
          merged.push(newEntry);
        }
      });
      
      return merged;
    };
  
    try {
      // Reset abort controller
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      // Reset status
      setProcessingStatus({
        currentChunk: 0,
        totalChunks: 0,
        entriesGenerated: 0,
        status: 'processing',
        progress: 0
      });
      setIndexEntries([]);
      setCurrentStep(2);
      
      console.log('Extracting text from DOCX...');
      
      // Extract text from DOCX
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({
        arrayBuffer: arrayBuffer
      });
      
      const fullText = result.value;
      console.log(`Total extracted text length: ${fullText.length} characters`);
  
      if (fullText.length < 1000) {
        console.warn('Extracted text seems unusually short. Check document parsing.');
        setProcessingStatus({
          ...processingStatus,
          status: 'error',
          error: 'Extracted text is too short. Please check the document format.'
        });
        return;
      }
      
      // Split into manageable chunks
      const paragraphs = fullText.split('\n').filter(p => p.trim().length > 0);
      console.log(`Document contains ${paragraphs.length} paragraphs`);
  
      // Target approximately 20 pages per chunk
      const PAGES_PER_CHUNK = 20; 
      const TARGET_CHUNKS = Math.max(1, Math.ceil(documentPageCount / PAGES_PER_CHUNK));
      console.log(`Targeting ${TARGET_CHUNKS} chunks (${PAGES_PER_CHUNK} pages per chunk)`);
  
      // Calculate approximate characters per page
      const CHARS_PER_PAGE = fullText.length / documentPageCount;
      const TARGET_CHUNK_SIZE = CHARS_PER_PAGE * PAGES_PER_CHUNK;
      
      console.log(`Estimated ${CHARS_PER_PAGE.toFixed(0)} chars per page, targeting chunks of ~${TARGET_CHUNK_SIZE.toFixed(0)} chars`);
      
      const chunks: string[] = [];
      let currentChunk = '';
  
      for (const paragraph of paragraphs) {
        // If adding this paragraph would exceed target size, finalize the chunk
        if ((currentChunk + paragraph).length > TARGET_CHUNK_SIZE && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = paragraph;
        } else {
          currentChunk += (currentChunk ? '\n' : '') + paragraph;
        }
      }
  
      // Add the final chunk if it has content
      if (currentChunk) chunks.push(currentChunk);
  
      const totalChunks = chunks.length;
      console.log(`Document split into ${totalChunks} chunks with sizes: ${chunks.map(c => c.length).join(', ')}`);
      
      setProcessingStatus(prev => ({
        ...prev,
        totalChunks,
        status: 'processing',
      }));
      
      // Generate document summary for better context
      let documentSummary = '';
      if (chunks.length > 0) {
        try {
          console.log('Generating document summary...');
          
          // Use the first chunk to generate a summary
          const sampleText = chunks[0].substring(0, 3000);
          
          const summaryResponse = await fetch('/api/get-document-summary', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: sampleText }),
            signal: abortControllerRef.current.signal
          });
          
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            documentSummary = summaryData.summary;
            console.log('Generated document summary:', documentSummary);
          } else {
            console.warn('Failed to generate document summary. Status:', summaryResponse.status);
          }
        } catch (summaryError) {
          console.warn('Error generating document summary:', summaryError);
          // Continue without a summary
        }
      }
      
      // FIRST PASS: Process each chunk to collect candidate terms
      let allEntries: IndexEntry[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Processing aborted');
        }
        
        setProcessingStatus(prev => ({
          ...prev,
          currentChunk: i + 1,
          progress: Math.round(((i + 0.5) / (totalChunks + 1)) * 100), // Reserve ~half the progress for first pass
        }));
        
        console.log(`Processing chunk ${i + 1} of ${totalChunks} (${chunks[i].length} characters)...`);
        
        try {
          // Calculate the page range for this chunk
          const startPage = Math.max(1, Math.round(1 + (i * documentPageCount / totalChunks)));
          const endPage = Math.min(documentPageCount, Math.round((i + 1) * documentPageCount / totalChunks));
          
          // Send chunk to the API for processing
          const response = await fetch('/api/generate-index', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chunk: chunks[i],
              chunkIndex: i,
              totalChunks,
              totalPages: documentPageCount,
              pageRange: { start: startPage, end: endPage },
              previousEntries: i > 0 ? allEntries.slice(0, 20) : [], // Send a sample of previous entries
              exampleIndex: showExampleInput ? exampleIndex : '', // Send example index if provided
              isSecondPass: false, // Explicitly mark as first pass
              documentSummary: documentSummary // Include summary for context
            }),
            signal: abortControllerRef.current.signal
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('API error response:', errorData);
            throw new Error(typeof errorData === 'object' && errorData?.error ? 
                errorData.error : 'Failed to process chunk');
          }
          
          const data = await response.json();
          
          if (data.entries && Array.isArray(data.entries)) {
            console.log(`Received ${data.entries.length} entries for chunk ${i + 1}`);
            
            // Merge new entries with existing ones
            allEntries = mergeIndexEntries(allEntries, data.entries);
            
            setIndexEntries(allEntries);
            setProcessingStatus(prev => ({
              ...prev,
              entriesGenerated: allEntries.length,
            }));
          } else {
            console.warn(`No entries received for chunk ${i + 1}:`, data);
          }
        } catch (chunkError) {
          console.error(`Error processing chunk ${i + 1}:`, chunkError);
          // Continue with the next chunk instead of failing completely
          if (i < chunks.length - 1) {
            console.log('Continuing with next chunk...');
            continue;
          } else {
            throw chunkError; // Throw on the last chunk
          }
        }
        
        // Add a small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // SECOND PASS: Refine the complete set of entries
      setProcessingStatus(prev => ({
        ...prev,
        status: 'merging',
        progress: 75, // Start second pass progress at 75%
      }));
      
      // Skip second pass if no entries were generated
      if (allEntries.length === 0) {
        setProcessingStatus(prev => ({
          ...prev,
          status: 'error',
          error: 'No index entries could be generated. Try using a smaller document or checking the console for errors.'
        }));
        return;
      }
      
      try {
        console.log(`Starting second pass with ${allEntries.length} raw entries...`);
        
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
            documentSummary
          }),
          signal: abortControllerRef.current.signal
        });
        
        if (!refinementResponse.ok) {
          const errorData = await refinementResponse.json();
          console.error('Refinement API error:', errorData);
          throw new Error(
            typeof errorData === 'object' && errorData?.error ? 
            errorData.error : 'Failed to refine index'
          );
        }
        
        const refinedData = await refinementResponse.json();
        
        if (refinedData.warning) {
          console.warn('Refinement warning:', refinedData.warning);
        }
        
        if (refinedData.entries && Array.isArray(refinedData.entries)) {
          console.log(`Received ${refinedData.entries.length} refined entries`);
          
          // Use the refined entries
          setIndexEntries(refinedData.entries);
          setProcessingStatus(prev => ({
            ...prev,
            entriesGenerated: refinedData.entries.length,
            status: 'complete',
            progress: 100,
          }));
        } else {
          console.error('Invalid refined entries:', refinedData);
          throw new Error('Refinement did not return valid entries');
        }
      } catch (refinementError) {
        console.error('Error during refinement phase:', refinementError);
        
        // If we have entries from the first pass, use them as a fallback
        if (allEntries.length > 0) {
          console.log(`Using ${allEntries.length} entries from first pass due to refinement error`);
          
          // Filter, sort, and present the entries from the first pass
          const filteredEntries = allEntries.filter(entry => 
            entry && 
            entry.term && 
            entry.term.trim() !== '' && 
            entry.term.toLowerCase() !== 'undefined' &&
            entry.term.toLowerCase() !== 'unknown term'
          );
          
          // Sort entries alphabetically
          filteredEntries.sort((a, b) => {
            if (!a.term) return 1;
            if (!b.term) return -1;
            return a.term.localeCompare(b.term);
          });
          
          // For each entry, sort its subentries
          filteredEntries.forEach(entry => {
            if (entry.subentries && entry.subentries.length > 0) {
              entry.subentries.sort((a, b) => a.term.localeCompare(b.term));
            }
          });
          
          setIndexEntries(filteredEntries);
          setProcessingStatus(prev => ({
            ...prev,
            status: 'complete',
            progress: 100,
            error: `Completed with first pass results only. Refinement error: ${refinementError instanceof Error ? refinementError.message : 'An unexpected error occurred'}`
          }));
        } else {
          // If we don't have any entries, show an error
          setProcessingStatus(prev => ({
            ...prev,
            status: 'error',
            error: refinementError instanceof Error ? refinementError.message : 'An unexpected error occurred during index refinement'
          }));
        }
      }
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setProcessingStatus(prev => ({
          ...prev,
          status: 'idle',
          error: 'Processing was cancelled'
        }));
      } else {
        console.error('Error processing document:', error);
        
        // Check if we have any partial results
        if (indexEntries.length > 0) {
          console.log(`Saving ${indexEntries.length} entries that were generated before the error`);
          setProcessingStatus(prev => ({
            ...prev,
            status: 'complete',
            progress: 100,
            error: `Completed with partial results. Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`
          }));
        } else {
          setProcessingStatus(prev => ({
            ...prev,
            status: 'error',
            error: error instanceof Error ? error.message : 'An unexpected error occurred'
          }));
        }
      }
    }
  };
  
  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setProcessingStatus(prev => ({
      ...prev,
      status: 'idle',
      error: 'Processing was cancelled by user'
    }));
  };
  
  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  // Format index entries for display
  const formatIndexEntries = () => {
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
    ));
  };
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full text-center max-w-5xl">
        <div className="text-center w-full mb-8 fade-in">
          <h1 className="verification-title mb-4 leading-snug font-serif text-gray-800">Create a professional index for your book.</h1>
          <p className="text-gray-600 font-sans fade-in-delay-1">
            Upload your document, set your preferences, and let Tandem do the rest.
          </p>
        </div>

        <div className="mb-8 w-full">
          {/* Step Indicators */}
          <div className="flex justify-between max-w-xl mx-auto mb-2">
            {steps.map((step, index) => (
              <div key={`indicator-${index}`} className="w-1/3 flex items-center">
                {index > 0 && (
                  <div className={`h-0.5 flex-grow ${index <= currentStep ? 'bg-mint' : 'bg-gray-200'}`} />
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
                  <span className={`${index < currentStep ? 'text-white' : index === currentStep ? 'text-mint' : 'text-gray-500'}`}>
                    {index + 1}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-grow ${index < currentStep ? 'bg-mint' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step Texts - separate but with matching widths */}
          <div className="flex justify-between max-w-3xl mx-auto mb-2">
            {steps.map((step, index) => (
              <div key={`text-${index}`} className="w-1/3 text-center">
                <div className={`text-sm font-medium ${index <= currentStep ? 'text-mint' : 'text-gray-500'}`}>
                  {step.name}
                </div>
                <div className="text-xs text-gray-500">
                  {step.description}
                </div>
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {file ? (
                    <p className="text-gray-700 font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-gray-700 font-medium">Upload your document</p>
                      <p className="text-gray-500 text-sm mt-1">Choose a .docx file</p>
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
              {processingStatus.error && <p className="text-red-500 text-sm mt-2">{processingStatus.error}</p>}
            </div>
          </div>
        )}
        
        {currentStep === 1 && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Configure Index Generation</h2>
            
            <div className="mb-6">
              <label htmlFor="page-count" className="block text-gray-700 font-medium mb-2">
                Number of Pages in Document
              </label>
              <input
                id="page-count"
                type="number"
                min="1"
                value={documentPageCount || ''}
                onChange={(e) => setDocumentPageCount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter page count"
              />
              <p className="text-gray-500 text-sm mt-1">This helps generate accurate page numbers for the index</p>
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
                <label htmlFor="use-example" className="ml-2 block text-gray-700 font-medium">
                  Use an Example Index for Style Reference (Optional)
                </label>
              </div>
              <p className="text-gray-500 text-sm mb-2">Providing an example index will help Tandem follow a specific style.</p>
              
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
                !documentPageCount || documentPageCount <= 0 ? 'bg-lightRed' : 'bg-darkRed hover:bg-darkRed'
              } transition-colors focus:outline-none focus:ring-2 focus:ring-darkRed focus:ring-offset-2`}
            >
              Generate Index
            </button>
          </div>
        )}
        
        {(processingStatus.status === 'processing' || processingStatus.status === 'merging') && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-sans text-gray-800 mb-4">
              {processingStatus.status === 'processing'
                ? `Processing Chunk ${processingStatus.currentChunk} of ${processingStatus.totalChunks}...`
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
                <span>{processingStatus.entriesGenerated} Entries Generated</span>
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
              <h2 className="text-xl font-semibold text-gray-800">Your Index</h2>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                {indexEntries.length} Main Entries
              </span>
            </div>
            
            {processingStatus.error && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">{processingStatus.error}</p>
              </div>
            )}
            
            <div className="h-96 text-left overflow-y-auto border border-gray-200 rounded p-4 mb-4 font-serif">
              {formatIndexEntries()}
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => {
                  setCurrentStep(1);
                  setProcessingStatus({
                    currentChunk: 0,
                    totalChunks: 0,
                    entriesGenerated: 0,
                    status: 'idle',
                    progress: 0
                  });
                }}
                className="py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none"
              >
                Adjust Settings
              </button>
              
              <button
                onClick={() => {
                  // Download as text file
                  const content = indexEntries.map(entry => {
                    let text = `${entry.term}, ${entry.pageNumbers}`;
                    if (entry.subentries && entry.subentries.length > 0) {
                      text += '\n' + entry.subentries.map(sub => `  - ${sub.term}, ${sub.pageNumbers}`).join('\n');
                    }
                    return text;
                  }).join('\n\n');
                  
                  const blob = new Blob([content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'book-index.txt';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
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
                    <rect x="15" y="25" width="70" height="55" rx="2" fill="#B54646" className="book-cover" />
                    
                    {/* Book spine */}
                    <rect x="15" y="25" width="5" height="55" fill="#933a3a" />
                    
                    {/* Pages - these animate to open */}
                    <path className="book-left-page" d="M20,30 L20,75 Q20,80 25,80 L50,80 L50,30 Z" fill="#f8f8f8" />
                    <path className="book-right-page" d="M80,30 L80,75 Q80,80 75,80 L50,80 L50,30 Z" fill="#f8f8f8" />
                    
                    {/* Page details - lines of text */}
                    <g className="book-lines">
                      <line x1="25" y1="40" x2="45" y2="40" stroke="#ddd" strokeWidth="1" />
                      <line x1="25" y1="45" x2="45" y2="45" stroke="#ddd" strokeWidth="1" />
                      <line x1="25" y1="50" x2="40" y2="50" stroke="#ddd" strokeWidth="1" />
                      <line x1="55" y1="40" x2="75" y2="40" stroke="#ddd" strokeWidth="1" />
                      <line x1="55" y1="45" x2="75" y2="45" stroke="#ddd" strokeWidth="1" />
                      <line x1="55" y1="50" x2="70" y2="50" stroke="#ddd" strokeWidth="1" />
                    </g>
                    
                    {/* Book title box */}
                    <rect x="25" y="15" width="50" height="10" rx="2" fill="#5EA89B" className="book-title" />
                  </svg>
                </div>
                <p className="text-darkRed font-medium text-xl">File Uploaded!</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IndexGenerator;