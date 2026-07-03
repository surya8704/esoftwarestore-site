import { Link, useLocation } from 'react-router-dom'
import { Headphones, Home, ShoppingCart, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function navItemClass(active) {
  return active
    ? 'mobile-nav-item active'
    : 'mobile-nav-item'
}

export default function MobileBottomNav({ itemCount, onCart }) {
  const { t } = useTranslation()
  const location = useLocation()
  const isShop = location.pathname === '/'
  const isSupport = location.pathname === '/support'
  const isAccount = location.pathname === '/account'

  return (
    <nav className="mobile-bottom-nav lg:hidden" aria-label="Mobile shortcuts">
      <Link to="/" className={navItemClass(isShop)} aria-current={isShop ? 'page' : undefined}>
        <Home size={22} strokeWidth={isShop ? 2.5 : 2} />
        <span>{t('shop')}</span>
      </Link>

      <button
        type="button"
        className="mobile-nav-item relative"
        onClick={onCart}
        aria-label={`${t('cart')}, ${itemCount} items`}
      >
        <ShoppingCart size={22} />
        {itemCount > 0 ? (
          <span className="absolute right-2 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f97316] px-1 text-[10px] font-bold text-white">
            {itemCount > 9 ? '9+' : itemCount}
          </span>
        ) : null}
        <span>{t('cart')}</span>
      </button>

      <Link to="/support" className={navItemClass(isSupport)} aria-current={isSupport ? 'page' : undefined}>
        <Headphones size={22} strokeWidth={isSupport ? 2.5 : 2} />
        <span>{t('support')}</span>
      </Link>

      <Link to="/account" className={navItemClass(isAccount)} aria-current={isAccount ? 'page' : undefined}>
        <User size={22} strokeWidth={isAccount ? 2.5 : 2} />
        <span>{t('account')}</span>
      </Link>
    </nav>
  )
}
