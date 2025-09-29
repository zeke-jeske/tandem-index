import Checkbox from '@/components/Checkbox'
import Input from '@/components/Input'
import SliderSelector from '@/components/SliderSelector'
import Textarea from '@/components/Textarea'
import classNames from 'classnames'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

export interface ConfigureStepProps {
  currentConfig: Config
  onSubmit: (newConfig: Config) => void
}

export interface Config {
  documentPageCount: number
  audienceLevel: '0' | '1' | '2'
  indexDensity: '0' | '1' | '2'
  targetAudience: string
  specialInstructions: string
  exampleIndex: string
}

export const audienceLevels = ['High School', 'Undergraduate', 'Graduate']
export const indexDensities = ['Broad', 'Medium', 'Detailed']

export default function ConfigureStep({ currentConfig, onSubmit }: ConfigureStepProps) {
  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<Config>({ defaultValues: currentConfig })
  const [showExampleInput, setShowExampleInput] = useState<boolean>(false)

  const pageCount = watch('documentPageCount')
  const disableSubmit = !pageCount || pageCount <= 0

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Configure Index Generation
      </h2>

      <Input
        label="Number of Pages in Document"
        id="page-count"
        type="number"
        className="w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        placeholder="Pages"
        {...register('documentPageCount', {
          required: true,
          min: 1,
          maxLength: 4,
          // Enforce integers
          pattern: /\d+/i,
        })}
        description="This helps generate accurate page numbers for the index."
      />

      <SliderSelector
        label="Audience Level"
        id="audience-level"
        values={audienceLevels}
        {...register('audienceLevel', { required: true })}
        description="Select the approximate audience level for your index."
      />

      <SliderSelector
        label="Index Density"
        id="index-density"
        values={indexDensities}
        {...register('indexDensity', { required: true })}
        description="Select how detailed you want your index to be."
      />

      <Textarea
        label="Target Audience Description"
        id="target-audience"
        rows={3}
        placeholder="Describe your book's target audience in a few sentences..."
        description="Helps Tandem tailor the index to your specific audience."
        {...register('targetAudience', { required: false, maxLength: 500 })}
      />

      <Textarea
        containerClassName="mb-8 text-left border-l-4 border-orange-500 bg-orange-50 p-4 rounded-r-lg mb-4"
        label="⚡ Special Instructions (Override All Other Settings)"
        id="special-instructions"
        rows={4}
        className="w-full px-3 py-2 border border-orange-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        placeholder="Enter any special instructions that should override all other settings. For example: 'Focus on technical terms only', 'Include all proper nouns', 'Use Chicago Manual of Style formatting', etc."
        descriptionClassName="text-orange-700 text-sm mt-2 font-medium"
        description="⚠️ These instructions will override all other settings above. Use this
          for specific requirements that take priority."
        {...register('specialInstructions', {
          required: false,
          maxLength: 1000,
        })}
      />

      <div className="mb-6">
        <Checkbox
          label="Use an Example Index for Style Reference (Optional)"
          id="use-example"
          description="Providing an example index will help Tandem follow a specific style."
          checked={showExampleInput}
          onChange={(e) => setShowExampleInput(e.target.checked)}
        />

        {showExampleInput && (
          <Textarea
            id="example-index"
            rows={6}
            {...register('exampleIndex', {
              required: false,
              maxLength: 10000,
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Paste an example index here to guide the style and format..."
          />
        )}
      </div>

      <button
        type="submit"
        onClick={handleSubmit(onSubmit)}
        disabled={disableSubmit}
        className={classNames(
          'w-fit py-3 px-4 rounded-lg text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-darkRed focus:ring-offset-2',
          disableSubmit ? 'bg-lightRed' : 'bg-darkRed hover:bg-darkRed',
        )}
        title={disableSubmit ? 'Please enter a valid page count' : ''}
      >
        Generate Index
      </button>
    </div>
  )
}
