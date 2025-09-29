import { extractPageNumbers } from '@/app/generator/indexProcessing'
import IndexEntry from '@/utils/indexEntry'
import { useState } from 'react'
import { ProcessingStatus } from './IndexGenerator'

interface CompletedIndexViewProps {
  entries: IndexEntry[]
  processingStatus: ProcessingStatus
  onAdjustSettings: () => void
}

export default function CompletedIndexView({
  entries,
  processingStatus,
  onAdjustSettings,
}: CompletedIndexViewProps) {
  const [sortMethod, setSortMethod] = useState<'alphabetical' | 'pageNumber'>(
    'alphabetical',
  )

  // Format index entries for display
  const formatIndexEntries = () => {
    if (sortMethod === 'pageNumber') {
      return formatIndexEntriesByPageNumber()
    }

    return entries.map((entry, index) => (
      <div key={index} className="mb-2">
        <div className="flex">
          <div className="grow font-medium">{entry.term}</div>
          <div className="text-gray-600">{entry.pageNumbers}</div>
        </div>
        {entry.subentries && entry.subentries.length > 0 && (
          <div className="pl-6">
            {entry.subentries.map((subentry, subIndex) => (
              <div key={`${index}-${subIndex}`} className="flex">
                <div className="grow">- {subentry.term}</div>
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

    entries.forEach((entry) => {
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
          <div className="grow font-medium">{entry.displayText}</div>
          <div className="text-gray-600">{entry.pageNumbers}</div>
        </div>
      </div>
    ))
  }

  function handleDownload() {
    // Download as text file based on current sort method
    let content = ''

    if (sortMethod === 'pageNumber') {
      // Create flattened entries for page number sorting
      const flattenedEntries: Array<{
        displayText: string
        pageNumbers: string
        numericPages: number[]
      }> = []

      entries.forEach((entry) => {
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

      content = flattenedEntries
        .map((entry) => `${entry.displayText}, ${entry.pageNumbers}`)
        .join('\n')
    } else {
      // Traditional alphabetical format
      content = entries
        .map((entry) => {
          let text = `${entry.term}, ${entry.pageNumbers}`
          if (entry.subentries && entry.subentries.length > 0) {
            text +=
              '\n' +
              entry.subentries
                .map((sub) => `  - ${sub.term}, ${sub.pageNumbers}`)
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
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Your Index</h2>
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
                setSortMethod(e.target.value as 'alphabetical' | 'pageNumber')
              }
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="alphabetical">Alphabetical</option>
              <option value="pageNumber">Page Number</option>
            </select>
          </div>
          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
            {entries.length} Main Entries
          </span>
        </div>
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
          onClick={onAdjustSettings}
          className="py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none"
        >
          Adjust Settings
        </button>

        <button
          onClick={handleDownload}
          className="py-2 px-4 bg-darkRed text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none"
        >
          Download Index
        </button>
      </div>
    </div>
  )
}
