interface UploadStepProps {
  file: File | null
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  error: string | null | undefined
}

export default function UploadStep({
  file,
  onFileChange,
  error,
}: UploadStepProps) {
  return (
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
            onChange={onFileChange}
          />
        </label>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
    </div>
  )
}
