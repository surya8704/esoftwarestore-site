import { useRef, useState } from 'react'
import { ImagePlus, Plus, Star, Trash2, Upload } from 'lucide-react'
import { uploadProductImage } from '../api'
import { isCustomProductImageUrl } from '../../lib/productImages'

function blankVariant(overrides = {}) {
  return {
    id: undefined,
    name: '',
    sku: '',
    price: '',
    originalPrice: '',
    stock: 10,
    description: '',
    imageUrl: '',
    tierLabel: '',
    isDefault: false,
    ...overrides,
  }
}

/**
 * Admin editor for Amazon-style product editions
 * (e.g. Windows 11 Home, Windows 11 Pro, Enterprise).
 */
export default function ProductVariantsEditor({
  variants = [],
  onChange,
  productPrice,
  productOriginalPrice,
  productStock,
  disabled = false,
  canUploadImages = true,
}) {
  const rows = variants.length ? variants : []
  const fileRefs = useRef({})
  const [uploadingIndex, setUploadingIndex] = useState(null)
  const [uploadError, setUploadError] = useState('')

  const updateRow = (index, patch) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    if (patch.isDefault) {
      onChange(next.map((row, i) => ({ ...row, isDefault: i === index })))
      return
    }
    onChange(next)
  }

  const addRow = () => {
    const isFirst = rows.length === 0
    onChange([
      ...rows,
      blankVariant({
        name: isFirst ? 'Standard' : '',
        price: productPrice || 29,
        originalPrice: productOriginalPrice || productPrice || 79,
        stock: productStock ?? 10,
        isDefault: isFirst || rows.every((r) => !r.isDefault),
      }),
    ])
  }

  const removeRow = (index) => {
    const next = rows.filter((_, i) => i !== index)
    if (next.length && !next.some((r) => r.isDefault)) {
      next[0] = { ...next[0], isDefault: true }
    }
    onChange(next)
  }

  const seedFromProduct = () => {
    onChange([
      blankVariant({
        name: 'Windows 11 Home',
        price: productPrice || 29,
        originalPrice: productOriginalPrice || productPrice || 79,
        stock: productStock ?? 10,
        description: 'Essential Windows 11 for everyday use — browsing, Office apps, and entertainment.',
        isDefault: true,
      }),
      blankVariant({
        name: 'Windows 11 Pro',
        price: Math.round((Number(productPrice) || 29) * 1.35),
        originalPrice: Math.round((Number(productOriginalPrice) || Number(productPrice) || 79) * 1.35),
        stock: productStock ?? 10,
        description: 'Business-ready Windows 11 with BitLocker, Remote Desktop, Hyper-V, and domain join.',
        isDefault: false,
      }),
    ])
  }

  const isAllowedImageFile = (file) => {
    const type = String(file?.type || '').toLowerCase()
    if (type.startsWith('image/')) return true
    const ext = String(file?.name || '').split('.').pop()?.toLowerCase()
    return ['jpg', 'jpeg', 'png', 'webp', 'wepg', 'gif'].includes(ext)
  }

  const handleUpload = async (index, event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!isAllowedImageFile(file)) {
      setUploadError('Please choose a JPEG, PNG, WebP, or GIF image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be 5MB or smaller')
      return
    }

    setUploadingIndex(index)
    setUploadError('')
    try {
      const data = await uploadProductImage(file)
      updateRow(index, { imageUrl: data.imageUrl })
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploadingIndex(null)
      if (fileRefs.current[index]) fileRefs.current[index].value = ''
    }
  }

  return (
    <div className="sm:col-span-2 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Product variants / editions</p>
          <p className="mt-1 text-xs text-slate-500">
            Each edition has its own name, price, description, and optional image — shown when customers select it
            (e.g. Windows 11 Home vs Windows 11 Pro).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!rows.length ? (
            <button
              type="button"
              disabled={disabled}
              onClick={seedFromProduct}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
            >
              Add Home + Pro example
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={addRow}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
          >
            <Plus size={12} /> Add edition
          </button>
        </div>
      </div>

      {uploadError ? <p className="mt-3 text-xs font-medium text-rose-600">{uploadError}</p> : null}

      {!rows.length ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:bg-white/5">
          No editions yet. Leave empty to use a single Standard variant from the product price, or add editions above.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((row, index) => {
            const hasImage = isCustomProductImageUrl(row.imageUrl) || Boolean(String(row.imageUrl || '').trim())
            return (
              <div
                key={row.id || `new-${index}`}
                className={`rounded-xl border p-3 ${row.isDefault ? 'border-[#f97316]/60 bg-[#fff7ed]/40 dark:bg-[#f97316]/5' : 'border-slate-200 dark:border-white/10'}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => updateRow(index, { isDefault: true })}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      row.isDefault
                        ? 'bg-[#f97316] text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                    }`}
                  >
                    <Star size={11} /> {row.isDefault ? 'Default edition' : 'Set as default'}
                  </button>
                  <button
                    type="button"
                    disabled={disabled || rows.length <= 1}
                    onClick={() => removeRow(index)}
                    className="rounded-full p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-40 dark:hover:bg-rose-500/10"
                    aria-label="Remove edition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
                    {hasImage ? (
                      <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus className="text-slate-400" size={22} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <span className="block text-[11px] font-medium text-slate-500">Edition image</span>
                    <div className="flex flex-wrap gap-2">
                      {canUploadImages ? (
                        <>
                          <input
                            ref={(el) => {
                              fileRefs.current[index] = el
                            }}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                            className="hidden"
                            onChange={(e) => handleUpload(index, e)}
                          />
                          <button
                            type="button"
                            disabled={disabled || uploadingIndex === index}
                            onClick={() => fileRefs.current[index]?.click()}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-white/10"
                          >
                            <Upload size={12} />
                            {uploadingIndex === index ? 'Uploading…' : 'Upload image'}
                          </button>
                        </>
                      ) : null}
                      {hasImage ? (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => updateRow(index, { imageUrl: '' })}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:border-white/10"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <input
                      value={row.imageUrl ?? ''}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { imageUrl: e.target.value })}
                      placeholder="Or paste image URL"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                  <label className="sm:col-span-2 lg:col-span-2">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">Edition name</span>
                    <input
                      value={row.name}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { name: e.target.value })}
                      placeholder="Windows 11 Pro"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">SKU (optional)</span>
                    <input
                      value={row.sku ?? ''}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { sku: e.target.value })}
                      placeholder="win11-pro"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">Price (USD)</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={row.price}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { price: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">Compare-at</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={row.originalPrice}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { originalPrice: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">Stock</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.stock}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { stock: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                  <label className="sm:col-span-2 lg:col-span-6">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">Edition description</span>
                    <textarea
                      value={row.description ?? ''}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { description: e.target.value })}
                      placeholder={'Describe this edition.\n\n- Feature unique to this edition\n- Another benefit'}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                    />
                    <span className="mt-1 block text-[11px] text-slate-400">
                      Shown when this edition is selected. Leave blank to fall back to the product description.
                    </span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
