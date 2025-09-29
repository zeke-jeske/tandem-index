import classNames from 'classnames'
import { formStyles } from './Input'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  description?: string
  labelClassName?: string
  containerClassName?: string
  descriptionClassName?: string
}

export default function Textarea({
  label,
  description,
  id,
  containerClassName = formStyles.container,
  labelClassName = classNames(formStyles.label, 'mb-2'),
  descriptionClassName = formStyles.description,
  className = classNames('w-full', formStyles.textInput),
  ...props
}: TextareaProps) {
  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={className}
        {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
      {description && <p className={descriptionClassName}>{description}</p>}
    </div>
  )
}
