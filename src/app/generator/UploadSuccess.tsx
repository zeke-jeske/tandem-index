import BookOpenAnimation from '@/components/BookOpenAnimation'

export default function UploadSuccessMessage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-lg shadow-lg">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 mb-4 relative">
            <BookOpenAnimation />
          </div>
          <p className="text-darkRed font-medium text-xl">File Uploaded!</p>
        </div>
      </div>
    </div>
  )
}
