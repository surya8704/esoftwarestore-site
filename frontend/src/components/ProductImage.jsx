import { useState } from 'react'
import { resolveStoreProductImage } from '../lib/productImages'

export default function ProductImage({
  product,
  src,
  name,
  category,
  slug,
  alt = '',
  className = 'h-full w-full object-cover',
  fallbackClassName = '',
  visualAccent = 'from-slate-400 to-slate-600',
  fallbackLabel = '',
  loading = 'lazy',
}) {
  const resolved = resolveStoreProductImage(
    product ?? { imageUrl: src, name: name || alt, category: category || fallbackLabel, slug },
  )
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(resolved) && !failed

  if (!showImage) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-sm font-semibold text-white ${visualAccent} ${fallbackClassName}`}
        role="img"
        aria-label={alt || fallbackLabel || name || 'Product'}
      >
        <span className="line-clamp-3 px-3 text-center">{fallbackLabel || name || alt || 'Software'}</span>
      </div>
    )
  }

  return (
    <img
      src={resolved}
      alt={alt || name || fallbackLabel || 'Product'}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
    />
  )
}
