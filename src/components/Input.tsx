import classNames from 'classnames'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  description?: string
  labelClassName?: string
  containerClassName?: string
  descriptionClassName?: string
}

export const formStyles = {
  container: 'mb-8 text-left',
  label: 'block text-gray-700 text-lg font-medium',
  description: 'text-gray-500 text-sm mt-1',
  /** Inputs (text, password, number) and textareas */
  textInput:
    'px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500',
  sliderInput: 'w-96 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer',
  checkboxInput:
    'h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded',
}

export default function Input({
  label,
  description,
  id,
  containerClassName = formStyles.container,
  labelClassName = classNames(formStyles.label, 'mb-2'),
  descriptionClassName = formStyles.description,
  className = classNames('w-32', formStyles.textInput),
  ...props
}: InputProps) {
  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      )}
      <input
        id={id}
        className={className}
        {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
      />
      {description && <p className={descriptionClassName}>{description}</p>}
    </div>
  )
}
