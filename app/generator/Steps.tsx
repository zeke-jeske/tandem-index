import classNames from 'classnames'

// TODO: Use this also for verify page
interface Step {
  name: string
  description: string
}

const steps: Step[] = [
  { name: 'Upload', description: 'Upload your document' },
  { name: 'Configure', description: 'Set parameters' },
  { name: 'Generate', description: 'Create your index' },
]

interface StepsProps {
  currentStep: 0 | 1 | 2
}

export default function Steps({ currentStep }: StepsProps) {
  return (
    <div className="mb-8 w-full">
      {/* Step indicators and labels */}
      <div className="flex justify-between max-w-3xl mx-auto mb-2">
        {steps.map((step, index) => (
          <div
            key={index}
            className="w-1/3 flex flex-col items-center text-center"
          >
            {/* A wrapper for the step indicator that also includes decorative lines to the right and left */}
            <div className="flex relative justify-center align-center w-full mb-4">
              {index > 0 && (
                <div
                  className={classNames(
                    // -left-0.5 instead of left-0 to slightly overlap the neighboring line
                    'h-0.5 w-1/2 absolute -left-0.5 top-1/2',
                    index <= currentStep ? 'bg-mint' : 'bg-gray-200',
                  )}
                />
              )}
              {/* The step indicator */}
              <div
                className={classNames(
                  // z-index 10 to ensure it appears above the connecting lines
                  'flex h-12 w-12 flex-shrink-0 z-10 items-center justify-center rounded-full',
                  // Style previous steps, current step, and future steps differently
                  index < currentStep && 'bg-mint text-white',
                  index === currentStep &&
                    'border-2 border-mint bg-white text-mint',
                  index > currentStep &&
                    'border-2 border-gray-200 bg-white text-gray-500',
                )}
              >
                {/* Step number, 1-indexed */}
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={classNames(
                    'h-0.5 w-1/2 absolute -right-0.5 top-1/2',
                    index < currentStep ? 'bg-mint' : 'bg-gray-200',
                  )}
                />
              )}
            </div>
            <div
              className={`text-sm font-medium ${index <= currentStep ? 'text-mint' : 'text-gray-500'}`}
            >
              {step.name}
            </div>
            <div className="text-xs text-gray-500">{step.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
