import classNames from 'classnames'
import { formStyles } from './Input'

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
  labelClassName?: string
  containerClassName?: string
  descriptionClassName?: string
}

export default function CheckboxProps({
  label,
  description,
  id,
  containerClassName = formStyles.container,
  labelClassName = classNames('ml-2', formStyles.label),
  descriptionClassName = formStyles.description,
  className = formStyles.checkboxInput,
  ...props
}: CheckboxProps) {
  return (
    <div className={containerClassName}>
      <div className="flex items-center mb-2">
        <input id={id} type="checkbox" className={className} {...props} />
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      </div>
      {description && <p className={descriptionClassName}>{description}</p>}
    </div>
  )
}
