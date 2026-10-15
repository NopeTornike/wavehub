import { useState, type ChangeEvent } from 'react'
import AuthIcon from './AuthIcons'

// A password field with the lock icon and a show/hide toggle (owner design 2026-10-15).
export default function PasswordInput({
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  label,
}: {
  name: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  autoComplete: string
  label: string
}) {
  const [shown, setShown] = useState(false)
  return (
    <label className="ax-field">
      <span className="ax-sr">{label}</span>
      <AuthIcon name="lock" />
      <input name={name} type={shown ? 'text' : 'password'} autoComplete={autoComplete} placeholder={placeholder} required value={value} onChange={onChange} />
      <button type="button" className="ax-eye" aria-label={shown ? 'პაროლის დამალვა' : 'პაროლის ჩვენება'} aria-pressed={shown} onClick={() => setShown((v) => !v)}>
        <AuthIcon name={shown ? 'eyeOff' : 'eye'} />
      </button>
    </label>
  )
}
