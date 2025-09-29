import classNames from 'classnames'
import { formStyles } from './Input'

export interface SliderSelectorProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'range' | 'min' | 'max' | 'step'
  > {
  label: string
  description?: string
  labelClassName?: string
  containerClassName?: string
  descriptionClassName?: string
  values: string[]
}

/**
 * A slider that choses between a list of discrete values.
 */
export default function SliderSelector({
  label,
  description,
  id,
  containerClassName = formStyles.container,
  labelClassName = classNames(formStyles.label, 'mb-2'),
  descriptionClassName = formStyles.description,
  values,
  className = formStyles.sliderInput,
  ...props
}: SliderSelectorProps) {
  return (
    <div className={containerClassName}>
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <div className="flex flex-col w-96 mt-2 mb-3">
        <div className="flex justify-between mb-2">
          {values.map((value) => (
            <span key={value} className="text-gray-500 text-sm">
              {value}
            </span>
          ))}
        </div>
        <input
          id={id}
          className={className}
          type="range"
          min={0}
          max={values.length - 1}
          step={1}
          {...props}
        />
      </div>
      {description && <p className={descriptionClassName}>{description}</p>}
    </div>
  )
}
