export default function SuccessPopup() {
  return (
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
  )
}
