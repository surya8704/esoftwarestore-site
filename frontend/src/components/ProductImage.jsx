import { useEffect, useState } from 'react'
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
  visualAccent = 'from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800',
  fallbackLabel = '',
  loading = 'lazy',
}) {
  const productLike =
    product ?? { imageUrl: src, name: name || alt, category: category || fallbackLabel, slug }
  const resolved = resolveStoreProductImage(productLike)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [resolved])

  const showImage = Boolean(resolved) && !failed

  if (!showImage) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-sm font-semibold text-store-muted ${visualAccent} ${fallbackClassName}`}
        role="img"
        aria-label={alt || fallbackLabel || name || 'Product'}
      >
        <span className="line-clamp-3 px-3 text-center">{fallbackLabel || name || alt || 'No image'}</span>
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
