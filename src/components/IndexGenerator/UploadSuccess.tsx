export default function UploadSuccessMessage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-lg shadow-lg">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 mb-4 relative">
            {/* TODO replace with improved SVG */}
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
          <p className="text-darkRed font-medium text-xl">File Uploaded!</p>
        </div>
      </div>
    </div>
  )
}
