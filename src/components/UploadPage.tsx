"use client";
import { useState } from 'react';

const UploadPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
interface FileChangeEvent extends React.ChangeEvent<HTMLInputElement> {
    target: HTMLInputElement & { files: FileList };
}

const handleFileChange = (e: FileChangeEvent) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.docx')) {
        setFile(selectedFile);
        setUploadError('');
    } else {
        setFile(null);
        setUploadError('Please select a .docx file');
    }
};
  
interface HandleSubmitEvent extends React.FormEvent<HTMLFormElement> {}

const handleSubmit = async (e: HandleSubmitEvent): Promise<void> => {
    e.preventDefault();
    if (!file) {
        setUploadError('Please select a file first');
        return;
    }
    
    setIsUploading(true);
    
    try {
        const formData = new FormData();
        formData.append('document', file);
        
        // Replace the simulated upload with a real API call
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Upload failed');
        }
        
        setUploadSuccess(true);
        setIsUploading(false);
    } catch (error) {
        setUploadError('Upload failed. Please try again.');
        setIsUploading(false);
    }
};
  
  const resetForm = () => {
    setFile(null);
    setUploadSuccess(false);
    setUploadError('');
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img 
            src="/images/logo.jpeg" 
            alt="Tandem Index Logo" 
            className="mx-auto mb-6"
          />
        </div>
        
        {!uploadSuccess ? (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
            <div className="mb-6">
              <label 
                htmlFor="document-upload" 
                className="block w-full cursor-pointer text-center p-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
              >
                <div className="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {file ? (
                    <p className="text-gray-700 font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-gray-700 font-medium">Drag your document here or click to browse</p>
                      <p className="text-gray-500 text-sm mt-1">Supports .docx files</p>
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
              {uploadError && <p className="text-red-500 text-sm mt-2">{uploadError}</p>}
            </div>
            
            <button
              type="submit"
              disabled={!file || isUploading}
              className={`w-full py-3 px-4 rounded-lg text-white font-medium ${
                !file || isUploading ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'
              } transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
            >
              {isUploading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Generate Index'
              )}
            </button>
          </form>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <div className="rounded-full bg-green-100 p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Document Uploaded Successfully!</h2>
            <p className="text-gray-600 mb-6">Your index is being generated. This may take a few moments.</p>
            <button
              onClick={resetForm}
              className="py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Upload Another Document
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;