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
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.docx')) {
        setFile(selectedFile);
        // Reset everything when a new file is selected
        setIndexEntries([]);
        setProcessingStatus({
          currentChunk: 0,
          totalChunks: 0,
          entriesGenerated: 0,
          status: 'idle',
          progress: 0
        });
      }
    }
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
      
      console.log('Extracting text from DOCX...');
      
      // Extract text from DOCX
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({
        arrayBuffer: arrayBuffer
      });
      
      const fullText = result.value;
      console.log(`Extracted ${fullText.length} characters of text`);
      
      // Split into manageable chunks
      const paragraphs = fullText.split('\n').filter(p => p.trim().length > 0);
      console.log(`Document contains ${paragraphs.length} paragraphs`);
      
      // For larger documents, use smaller chunk sizes
      let CHUNK_SIZE = 500; // Default chunk size
      if (paragraphs.length > 2000) {
        CHUNK_SIZE = 250;
      } else if (paragraphs.length > 1000) {
        CHUNK_SIZE = 350;
      }
      
      const chunks = [];
      
      for (let i = 0; i < paragraphs.length; i += CHUNK_SIZE) {
        chunks.push(paragraphs.slice(i, i + CHUNK_SIZE).join('\n'));
      }
      
      const totalChunks = chunks.length;
      console.log(`Document split into ${totalChunks} chunks (${CHUNK_SIZE} paragraphs per chunk)`);
      
      setProcessingStatus(prev => ({
        ...prev,
        totalChunks,
        status: 'processing',
      }));
      
      // Process each chunk sequentially
      const mergeIndexEntries = (existingEntries: IndexEntry[], newEntries: IndexEntry[]): IndexEntry[] => {
        const merged = [...existingEntries];
        
        newEntries.forEach(newEntry => {
          // Check if this term already exists
          const existingIndex = merged.findIndex(e => e.term.toLowerCase() === newEntry.term.toLowerCase());
          
          if (existingIndex >= 0) {
            // Merge page numbers for existing entry
            const existing = merged[existingIndex];
            const existingPages = existing.pageNumbers.split(', ').map(p => p.trim());
            const newPages = newEntry.pageNumbers.split(', ').map(p => p.trim());
            
            // Combine page numbers and remove duplicates
            const allPages = [...existingPages, ...newPages]
              .filter(p => p && !p.toLowerCase().includes('see'))
              .map(p => parseInt(p, 10))
              .filter(p => !isNaN(p))
              .sort((a, b) => a - b);
            
            // Convert back to string format
            const uniquePages = [...new Set(allPages)].join(', ');
            
            // Handle any "see" or "see also" references
            const seeReferences = [...existingPages, ...newPages]
              .filter(p => p && p.toLowerCase().includes('see'))
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
                  const existingSubPages = existing.subentries![existingSubIndex].pageNumbers.split(', ').map(p => p.trim());
                  const newSubPages = newSubentry.pageNumbers.split(', ').map(p => p.trim());
                  
                  // Combine page numbers and remove duplicates
                  const allSubPages = [...existingSubPages, ...newSubPages]
                    .filter(p => p && !p.toLowerCase().includes('see'))
                    .map(p => parseInt(p, 10))
                    .filter(p => !isNaN(p))
                    .sort((a, b) => a - b);
                  
                  // Convert back to string format
                  const uniqueSubPages = [...new Set(allSubPages)].join(', ');
                  
                  // Handle any "see" or "see also" references
                  const seeSubReferences = [...existingSubPages, ...newSubPages]
                    .filter(p => p && p.toLowerCase().includes('see'))
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

      let allEntries: IndexEntry[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Processing aborted');
        }
        
        setProcessingStatus(prev => ({
          ...prev,
          currentChunk: i + 1,
          progress: Math.round(((i + 1) / totalChunks) * 100),
        }));
        
        console.log(`Processing chunk ${i + 1} of ${totalChunks} (${chunks[i].length} characters)...`);
        
        try {
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
              previousEntries: allEntries, // Send previous entries for context
              exampleIndex: showExampleInput ? exampleIndex : '' // Send example index if provided
            }),
            signal: abortControllerRef.current.signal
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('API error response:', errorData);
            throw new Error(errorData.error || 'Failed to process chunk');
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
      
      // Final merging and sorting
      setProcessingStatus(prev => ({
        ...prev,
        status: 'merging',
        progress: 95,
      }));

      // Skip if no entries were generated
      if (allEntries.length === 0) {
        setProcessingStatus(prev => ({
          ...prev,
          status: 'error',
          error: 'No index entries could be generated. Try using a smaller document or checking the console for errors.'
        }));
        return;
      }
      
      // Sort entries alphabetically
      allEntries.sort((a, b) => a.term.localeCompare(b.term));
      
      // For each entry, sort its subentries
      allEntries.forEach(entry => {
        if (entry.subentries && entry.subentries.length > 0) {
          entry.subentries.sort((a, b) => a.term.localeCompare(b.term));
        }
      });
      
      setIndexEntries(allEntries);
      setProcessingStatus(prev => ({
        ...prev,
        status: 'complete',
        progress: 100,
      }));
      
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
  
  const mergeIndexEntries = (existingEntries: IndexEntry[], newEntries: IndexEntry[]): IndexEntry[] => {
    const merged = [...existingEntries];
    
    newEntries.forEach(newEntry => {
      // Check if this term already exists
      const existingIndex = merged.findIndex(e => e.term.toLowerCase() === newEntry.term.toLowerCase());
      
      if (existingIndex >= 0) {
        // Merge page numbers for existing entry
        const existing = merged[existingIndex];
        const existingPages = existing.pageNumbers.split(', ').map(p => p.trim());
        const newPages = newEntry.pageNumbers.split(', ').map(p => p.trim());
        
        // Combine page numbers and remove duplicates
        const allPages = [...existingPages, ...newPages]
          .filter(p => p && !p.toLowerCase().includes('see'))
          .map(p => parseInt(p, 10))
          .filter(p => !isNaN(p))
          .sort((a, b) => a - b);
        
        // Convert back to string format
        const uniquePages = [...new Set(allPages)].join(', ');
        
        // Handle any "see" or "see also" references
        const seeReferences = [...existingPages, ...newPages]
          .filter(p => p && p.toLowerCase().includes('see'))
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
              const existingSubPages = existing.subentries![existingSubIndex].pageNumbers.split(', ').map(p => p.trim());
              const newSubPages = newSubentry.pageNumbers.split(', ').map(p => p.trim());
              
              // Combine page numbers and remove duplicates
              const allSubPages = [...existingSubPages, ...newSubPages]
                .filter(p => p && !p.toLowerCase().includes('see'))
                .map(p => parseInt(p, 10))
                .filter(p => !isNaN(p))
                .sort((a, b) => a - b);
              
              // Convert back to string format
              const uniqueSubPages = [...new Set(allSubPages)].join(', ');
              
              // Handle any "see" or "see also" references
              const seeSubReferences = [...existingSubPages, ...newSubPages]
                .filter(p => p && p.toLowerCase().includes('see'))
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
          <div className="flex-grow">{entry.term}</div>
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Tandem Index Generator</h1>
          <p className="text-gray-600 mt-2">
            Upload a document to generate a professional index
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="mb-6">
            <label htmlFor="document-upload" className="block text-gray-700 font-medium mb-2">
              Upload Document
            </label>
            <div className="flex items-center">
              <input
                id="document-upload"
                type="file"
                accept=".docx"
                onChange={handleFileChange}
                className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={processingStatus.status === 'processing' || processingStatus.status === 'merging'}
              />
            </div>
            {file && <p className="text-green-600 text-sm mt-1">Selected: {file.name}</p>}
          </div>
          
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
              disabled={processingStatus.status === 'processing' || processingStatus.status === 'merging'}
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
                disabled={processingStatus.status === 'processing' || processingStatus.status === 'merging'}
              />
              <label htmlFor="use-example" className="ml-2 block text-gray-700 font-medium">
                Use an Example Index for Style Reference
              </label>
            </div>
            <p className="text-gray-500 text-sm mb-2">Providing an example index will help Claude follow a specific style and format</p>
            
            {showExampleInput && (
              <textarea
                id="example-index"
                rows={6}
                value={exampleIndex}
                onChange={(e) => setExampleIndex(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Paste an example index here to guide the style and format..."
                disabled={processingStatus.status === 'processing' || processingStatus.status === 'merging'}
              />
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={processDocument}
              disabled={!file || documentPageCount <= 0 || processingStatus.status === 'processing' || processingStatus.status === 'merging'}
              className={`flex-grow py-3 px-4 rounded-lg text-white font-medium ${
                !file || documentPageCount <= 0 || processingStatus.status === 'processing' || processingStatus.status === 'merging'
                  ? 'bg-indigo-300'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
            >
              {processingStatus.status === 'processing' || processingStatus.status === 'merging'
                ? 'Processing...'
                : 'Generate Index'}
            </button>
            
            {(processingStatus.status === 'processing' || processingStatus.status === 'merging') && (
              <button
                onClick={cancelProcessing}
                className="py-3 px-4 rounded-lg text-white font-medium bg-red-600 hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        
        {(processingStatus.status === 'processing' || processingStatus.status === 'merging') && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {processingStatus.status === 'processing'
                ? `Processing Chunk ${processingStatus.currentChunk} of ${processingStatus.totalChunks}`
                : 'Finalizing Index'}
            </h2>
            
            <div className="relative pt-1">
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-200">
                <div
                  style={{ width: `${processingStatus.progress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-500"
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>{processingStatus.progress}% Complete</span>
                <span>{processingStatus.entriesGenerated} Entries Generated</span>
              </div>
            </div>
          </div>
        )}
        
        {processingStatus.status === 'error' && (
          <div className="bg-red-50 p-6 rounded-lg shadow-md mb-6 border border-red-200">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{processingStatus.error}</p>
          </div>
        )}
        
        {processingStatus.status === 'complete' && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Generated Index</h2>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                {indexEntries.length} Main Entries
              </span>
            </div>
            
            <div className="h-96 overflow-y-auto border border-gray-200 rounded p-4 mb-4 font-serif">
              {formatIndexEntries()}
            </div>
            
            <div className="flex justify-end">
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
                className="py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Download Index
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IndexGenerator;