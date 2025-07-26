"use client";

import { useState } from 'react';

interface ComparisonResult {
  winner: 'index1' | 'index2' | 'tie';
  overallScore: {
    index1: number;
    index2: number;
  };
  criteria: {
    comprehensiveness: { index1: number; index2: number; explanation: string };
    accuracy: { index1: number; index2: number; explanation: string };
    organization: { index1: number; index2: number; explanation: string };
    crossReferences: { index1: number; index2: number; explanation: string };
    formatting: { index1: number; index2: number; explanation: string };
  };
  detailedAnalysis: string;
  recommendation: string;
  thinking?: string;
}

const IndexComparison = () => {
  const [index1, setIndex1] = useState('');
  const [index2, setIndex2] = useState('');
  const [index1Title, setIndex1Title] = useState('Index A');
  const [index2Title, setIndex2Title] = useState('Index B');
  const [isComparing, setIsComparing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!index1.trim() || !index2.trim()) {
      setError('Please provide both indexes to compare.');
      return;
    }

    setIsComparing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/compare-indexes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          index1: index1.trim(),
          index2: index2.trim(),
          index1Title,
          index2Title
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to compare indexes');
      }

      const comparisonResult = await response.json();
      setResult(comparisonResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="px-6 py-4" style={{backgroundColor: '#9E3B49'}}>
          <h1 className="text-3xl font-bold text-white">Compare Indexes</h1>
        </div>

        <div className="p-6">
          {/* Index Titles */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="index1Title" className="block text-sm font-medium text-gray-700 mb-2">
                Title for First Index
              </label>
              <input
                id="index1Title"
                type="text"
                value={index1Title}
                onChange={(e) => setIndex1Title(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Original Index, Old System, etc."
              />
            </div>
            <div>
              <label htmlFor="index2Title" className="block text-sm font-medium text-gray-700 mb-2">
                Title for Second Index
              </label>
              <input
                id="index2Title"
                type="text"
                value={index2Title}
                onChange={(e) => setIndex2Title(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., New System, Updated Index, etc."
              />
            </div>
          </div>

          {/* Index Input Areas */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="index1" className="block text-sm font-medium text-gray-700 mb-2">
                {index1Title}
              </label>
              <textarea
                id="index1"
                value={index1}
                onChange={(e) => setIndex1(e.target.value)}
                rows={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Paste the first index here..."
              />
              <div className="text-sm text-gray-500 mt-1">
                {index1.length} characters, ~{Math.round(index1.split('\n').filter(l => l.trim()).length)} entries
              </div>
            </div>

            <div>
              <label htmlFor="index2" className="block text-sm font-medium text-gray-700 mb-2">
                {index2Title}
              </label>
              <textarea
                id="index2"
                value={index2}
                onChange={(e) => setIndex2(e.target.value)}
                rows={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                placeholder="Paste the second index here..."
              />
              <div className="text-sm text-gray-500 mt-1">
                {index2.length} characters, ~{Math.round(index2.split('\n').filter(l => l.trim()).length)} entries
              </div>
            </div>
          </div>

          {/* Compare Button */}
          <div className="text-center mb-6">
            <button
              onClick={handleCompare}
              disabled={isComparing || !index1.trim() || !index2.trim()}
              className={`px-8 py-3 rounded-lg font-semibold text-white transition-all ${
                isComparing || !index1.trim() || !index2.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transform hover:scale-105'
              }`}
            >
              {isComparing ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Comparing...
                </span>
              ) : (
                'Compare Indexes'
              )}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex">
                <div className="text-red-600">
                  <strong>Error:</strong> {error}
                </div>
              </div>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Comparison Results</h2>
              
              {/* Winner Announcement */}
              <div className={`p-4 rounded-lg mb-6 text-center ${
                result.winner === 'index1' ? 'bg-blue-100 border border-blue-300' :
                result.winner === 'index2' ? 'bg-purple-100 border border-purple-300' :
                'bg-yellow-100 border border-yellow-300'
              }`}>
                <h3 className="text-xl font-bold mb-2">
                  {result.winner === 'tie' ? '🤝 It\'s a Tie!' : 
                   result.winner === 'index1' ? `🏆 Winner: ${index1Title}` :
                   `🏆 Winner: ${index2Title}`}
                </h3>
                <div className="text-lg">
                  <strong>{index1Title}:</strong> {result.overallScore.index1}/100 | 
                  <strong> {index2Title}:</strong> {result.overallScore.index2}/100
                </div>
              </div>

              {/* Detailed Scores */}
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {Object.entries(result.criteria).map(([criterion, scores]) => (
                  <div key={criterion} className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold capitalize mb-2">{criterion}</h4>
                    <div className="space-y-1">
                      <div className={`text-sm ${scores.index1 > scores.index2 ? 'font-bold text-blue-600' : 'text-gray-600'}`}>
                        {index1Title}: {scores.index1}/10
                      </div>
                      <div className={`text-sm ${scores.index2 > scores.index1 ? 'font-bold text-purple-600' : 'text-gray-600'}`}>
                        {index2Title}: {scores.index2}/10
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Detailed Analysis */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Detailed Analysis</h3>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="whitespace-pre-wrap text-gray-700">{result.detailedAnalysis}</p>
                </div>

                <h3 className="text-lg font-semibold">Recommendation</h3>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="whitespace-pre-wrap text-gray-700">{result.recommendation}</p>
                </div>

                {/* Thinking Process (if available) */}
                {result.thinking && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-lg font-semibold text-gray-600 hover:text-gray-800">
                      🧠 Claude's Thinking Process (Click to expand)
                    </summary>
                    <div className="bg-gray-100 p-4 rounded-lg border mt-2 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">{result.thinking}</pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IndexComparison; 