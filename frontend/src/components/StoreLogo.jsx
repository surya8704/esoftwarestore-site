import { Link } from 'react-router-dom'

export default function StoreLogo({ className = 'h-9 w-auto max-w-[200px] sm:max-w-[220px]', light = false, onClick }) {
  const imageClass = light ? `${className} brightness-0 invert` : className

  return (
    <Link to="/" className="inline-flex shrink-0 items-center" onClick={onClick} aria-label="eSoftware Store home">
      <img
        src="/logo.svg"
        alt="eSoftware Store"
        className={imageClass}
        width={220}
        height={49}
        decoding="async"
      />
    </Link>
  )
}
