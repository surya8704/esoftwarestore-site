import ProductFormTab from './ProductFormTab'
import ProductListTab from './ProductListTab'

export default function ProductsTab({
  view = 'list',
  editId = null,
  highlightProductId = null,
  statusMessage = '',
  onNavigate,
  onStatusClear,
  ...props
}) {
  if (view === 'form') {
    return (
      <ProductFormTab
        {...props}
        editId={editId}
        onDone={(productId, message) => onNavigate?.('list', { highlightProductId: productId, statusMessage: message })}
        onCancel={() => onNavigate?.('list')}
      />
    )
  }

  return (
    <ProductListTab
      {...props}
      highlightProductId={highlightProductId}
      statusMessage={statusMessage}
      onStatusClear={onStatusClear}
      onAdd={() => onNavigate?.('form', { editId: null })}
      onEdit={(id) => onNavigate?.('form', { editId: id })}
    />
  )
}
