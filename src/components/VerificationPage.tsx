// src/components/VerificationPage.tsx
"use client";
import { useState } from 'react';
import { parseDocumentSample, selectRandomPassages } from '../utils/documentParser';

interface TextSegment {
  text: string;
}

interface VerificationResult {
  passage: string;
  pageNumber?: number;
  confidence?: 'high' | 'medium' | 'low';
}

const VerificationPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [passages, setPassages] = useState<TextSegment[]>([]);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [fullText, setFullText] = useState('');
  const [documentPageCount, setDocumentPageCount] = useState<number>(0);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false); // for upload success message

  const steps = [
    { name: 'Upload', description: 'Upload your document' },
    { name: 'Verify', description: 'Verify page numbers' },
    { name: 'Generate', description: 'Create your index' }
  ];
  
  const [currentStep, setCurrentStep] = useState(0);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.docx')) {
          setFile(selectedFile);
          setError('');
          setShowUploadSuccess(true);
          setCurrentStep(1);
          setTimeout(() => setShowUploadSuccess(false), 2000);
      } else {
        setFile(null);
        setError('Please select a .docx file');
      }
    }
  };
  
  const handleProcessDocument = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      // Parse the document
      const parsedDoc = await parseDocumentSample(file);
      
      if (parsedDoc.error) {
        setError(parsedDoc.error);
        setIsProcessing(false);
        return;
      }
      
      // Select random passages
      const selectedPassages = selectRandomPassages(parsedDoc, 3);
      setPassages(selectedPassages);
      setFullText(parsedDoc.fullText);
      
      // Initialize results
      setResults(selectedPassages.map(p => ({
        passage: p.text,
        predictedPageNumber: undefined,
        confidence: undefined
      })));

      setIsProcessing(false);
    } catch (error) {
      console.error('Error processing document:', error);
      setError('Failed to process the document. Please try again.');
      setIsProcessing(false);
    }
  };
  
 // In the handleVerify function of src/components/VerificationPage.tsx
const handleVerify = async () => {
    if (passages.length === 0) {
      setError('No passages selected for verification');
      return;
    }

    if (!documentPageCount || documentPageCount <= 0) {
        setError('Please enter the number of pages in your document');
        return;
    }
    
    setIsVerifying(true);
    setError('');
    
    try {
      console.log('Sending verification request with passages:', passages.map(p => p.text));
      
      // Call the verify API with the passages and document text
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          passages: passages.map(p => p.text),
          fullText: fullText,
          documentPageCount: documentPageCount
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('API error:', data);
        throw new Error(`API error: ${response.status}. ${data.error || ''} ${data.details || ''}`);
      }
      
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error occurred');
      }

      // Add this after you set the results state
        console.log('Results data from API:', data.results);
      
      // Update results with Claude's predictions
      setResults(data.results);
      setVerificationComplete(true);
      setCurrentStep(2);
      setIsVerifying(false);
      
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error verifying with Tandem:', err);
      setError(`Failed to verify passages: ${err.message}`);
      setIsVerifying(false);
    }
  };
  
  const handleContinue = () => {
    // In a real implementation, this would redirect to the full document upload
    // or index generation page
    alert('Verification successful! Proceed to full document upload.');
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="w-full text-center max-w-5xl">
        <div className="text-center mb-8 fade-in">
        <h1 className="verification-title mb-4 leading-snug font-serif text-gray-800">Verify that Tandem can understand your book.</h1>          
        <p className="text-gray-600 font-sans fade-in-delay-1">
            Upload a sample chapter to verify Tandem's understanding of your page numbers and chapters.
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
        
        {!passages.length ? (
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
                      <p className="text-gray-700 font-medium">Upload a sample chapter</p>
                      <p className="text-gray-500 text-sm mt-1">Choose a .docx file (10-30 pages)</p>
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
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
            <div className="flex justify-center gap-4"> {/* Buttons */}
              {file && (
                <button
                  onClick={() => setFile(null)}
                  className="py-3 px-4 inline-flex items-center border border-gray-300 shadow-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mint"
                >
                  <svg className="mr-1.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              )}
              <button
                onClick={handleProcessDocument}
                disabled={!file || isProcessing}
                className={`py-3 px-4 rounded-lg text-white font-medium ${
                  !file || isProcessing ? 'bg-lightRed' : 'bg-darkRed hover:bg-darkRed'
                } transition-colors focus:outline-none focus:ring-2 focus:ring-darkRed focus:ring-offset-2`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Process Chapter'
                )}
              </button>
            </div>

          {/* Show upload success message */}
            {showUploadSuccess && (
            <div className="fixed inset-0 flex items-center justify-center z-50">
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-lg shadow-lg">
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 mb-4 relative">
                    <svg className="animate-book-open" viewBox="0 0 100 100">
                      {/* Simple book icon that opens */}
                      <rect x="20" y="20" width="60" height="10" rx="2" fill="#5EA89B" className="animate-pulse" />
                      <path d="M20,30 L20,80 Q20,85 25,85 L50,85 L50,30 Z" fill="#B54646" />
                      <path d="M80,30 L80,80 Q80,85 75,85 L50,85 L50,30 Z" fill="#5EA89B" />
                    </svg>
                  </div>
                  <p className="text-darkRed font-medium text-xl">File Uploaded!</p>
                </div>
              </div>
            </div>
          )}

          </div>

        ) : !verificationComplete ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Selected Passages</h2>
            <p className="text-gray-600 mb-4">
              We've selected 3 random passages from your document. Click "Verify with Tandem" to test if our AI can identify their page numbers.
            </p>

            {/* Page count input */}
            <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-2">
                How many pages is your document?
                </label>
                <input
                type="number"
                min="1"
                value={documentPageCount || ''}
                onChange={(e) => setDocumentPageCount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter page count"
                />
                {!documentPageCount && <p className="text-gray-500 text-sm mt-1">This helps Tandem accurately identify page numbers</p>}
            </div>
            
            <div className="space-y-4 mb-6">
              {passages.map((passage, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-gray-800 font-medium">Passage {index + 1}:</p>
                  <p className="text-gray-600 italic mt-1">"{passage.text}"</p>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleVerify}
              disabled={isVerifying || !documentPageCount}
              className={`w-full py-3 px-4 rounded-lg text-white font-medium ${
                isVerifying || !documentPageCount ? 'bg-lightRed' : 'bg-darkRed hover:bg-darkRed'
              } transition-colors focus:outline-none focus:ring-2 focus:ring-darkRed focus:ring-offset-2`}
            >
              {isVerifying ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying with Tandem...
                </span>
              ) : (
                'Verify with Tandem'
              )}
            </button>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Verification Results</h2>
            
            <div className="space-y-4 mb-6">
                {results.map((result, index) => (
                <div 
                    key={index} 
                    className={`p-3 rounded border ${
                    result.confidence === 'high' 
                        ? 'bg-green-50 border-green-200' 
                        : result.confidence === 'medium'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                >
                    <p className="text-gray-800 font-medium">Passage {index + 1}:</p>
                    <p className="text-gray-600 italic mt-1">"{result.passage}"</p>
                    <div className="flex justify-between mt-2">
                    <p className="text-gray-600">Page Number: {result.pageNumber || 'Not provided'}</p>
                    <p className={`font-medium ${
                        result.confidence === 'high' 
                        ? 'text-green-600' 
                        : result.confidence === 'medium'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                    }`}>
                        {result.confidence === 'high' 
                        ? 'High Confidence' 
                        : result.confidence === 'medium'
                            ? 'Medium Confidence'
                            : 'Low Confidence'}
                    </p>
                    </div>
                </div>
                ))}
            </div>
            
            <div className="flex flex-col space-y-3">
              {results.every(r => r.confidence === 'high' || r.confidence === 'medium') ? (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-green-800 font-medium">Verification successful!</p>
                    <p className="text-green-600 mt-1">Tandem can confidently identify page locations in your document.</p>
                  </div>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <p className="text-gray-800 font-medium">User Confirmation</p>
                    <p className="text-gray-600 mt-1">Please check these page numbers against your document. Are they accurate?</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleContinue}
                      className="flex-1 py-3 px-4 rounded-lg text-white font-medium bg-indigo-600 hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Yes, Continue
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="flex-1 py-3 px-4 rounded-lg text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      No, Try Again
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-yellow-800 font-medium">Uncertain verification</p>
                    <p className="text-yellow-600 mt-1">Tandem has low confidence in some page numbers. This may affect the quality of your index.</p>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full py-3 px-4 rounded-lg text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Try Another Sample
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationPage;