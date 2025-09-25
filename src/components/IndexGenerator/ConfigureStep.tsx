interface ConfigureStepProps {
  documentPageCount: number
  setDocumentPageCount: (count: number) => void
  audienceLevel: number
  setAudienceLevel: (level: 0 | 1 | 2) => void
  indexDensity: number
  setIndexDensity: (density: 0 | 1 | 2) => void
  targetAudience: string
  setTargetAudience: (audience: string) => void
  specialInstructions: string
  setSpecialInstructions: (instructions: string) => void
  showExampleInput: boolean
  setShowExampleInput: (show: boolean) => void
  exampleIndex: string
  setExampleIndex: (index: string) => void
  onSubmit: () => void
}

export const audienceLevels = ['High School', 'Undergraduate', 'Graduate']
export const indexDensities = ['Broad', 'Medium', 'Detailed']

export default function ConfigureStep({
  documentPageCount,
  setDocumentPageCount,
  audienceLevel,
  setAudienceLevel,
  indexDensity,
  setIndexDensity,
  targetAudience,
  setTargetAudience,
  specialInstructions,
  setSpecialInstructions,
  showExampleInput,
  setShowExampleInput,
  exampleIndex,
  setExampleIndex,
  onSubmit: onSubmit,
}: ConfigureStepProps) {
  return (
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
          onChange={(e) => setDocumentPageCount(parseInt(e.target.value) || 0)}
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
            {audienceLevels.map((level) => (
              <span key={level} className="text-gray-500 text-sm">
                {level}
              </span>
            ))}
          </div>
          <input
            id="audience-level"
            type="range"
            min="0"
            max="2"
            step="1"
            value={audienceLevel}
            onChange={(e) =>
              setAudienceLevel(parseInt(e.target.value) as 0 | 1 | 2)
            }
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
            {indexDensities.map((density) => (
              <span key={density} className="text-gray-500 text-sm">
                {density}
              </span>
            ))}
          </div>
          <input
            id="index-density"
            type="range"
            min="0"
            max="2"
            step="1"
            value={indexDensity}
            onChange={(e) =>
              setIndexDensity(parseInt(e.target.value) as 0 | 1 | 2)
            }
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
            ⚠️ These instructions will override all other settings above. Use
            this for specific requirements that take priority.
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
          Providing an example index will help Tandem follow a specific style.
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
        onClick={onSubmit}
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
  )
}
