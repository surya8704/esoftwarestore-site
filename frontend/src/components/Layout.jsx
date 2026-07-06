import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Heart, Headphones, Menu, Package, Search, Shield, ShoppingCart, Sparkles, User, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getInstantProducts, loadProducts } from '../lib/products'
import {
  MAILTO_URL,
  SUPPORT_ADDRESS,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  WHATSAPP_URL,
} from '../lib/contact'
import { useApp } from '../context/AppContext'
import CartDrawer from './CartDrawer'
import ThemeToggle from './ThemeToggle'
import ChatWidget from './ChatWidget'
import MobileBottomNav from './MobileBottomNav'
import StoreLogo from './StoreLogo'

const FALLBACK_CATEGORIES = ['Windows', 'Design']

function navLinkClass(active) {
  return active
    ? 'font-semibold text-[#f97316]'
    : 'text-store-muted hover:text-[#f97316] transition-colors'
}

export default function Layout({ children }) {
  const { t } = useTranslation()
  const { cart, currency, country, locale, refreshCart, removeFromCart, user } = useApp()
  const [cartOpen, setCartOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categories, setCategories] = useState(() => {
    const cats = [...new Set(getInstantProducts().map((p) => p.category))].filter(Boolean).sort()
    return cats.length ? cats : FALLBACK_CATEGORIES
  })
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isAdmin = location.pathname.startsWith('/admin')
  const itemCount = cart?.items?.length ?? 0
  const activeCategory = searchParams.get('category')
  const activeQuery = searchParams.get('q') ?? ''
  const isShopHome = location.pathname === '/' && !activeCategory && !activeQuery
  const isProductDetail = location.pathname.startsWith('/product/')

  useEffect(() => {
    refreshCart().catch(() => {})
  }, [location.pathname, refreshCart])

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    setSearchQuery(activeQuery)
  }, [activeQuery])

  useEffect(() => {
    const fromCache = getInstantProducts()
    if (fromCache.length) {
      const cats = [...new Set(fromCache.map((p) => p.category))].filter(Boolean).sort()
      if (cats.length) setCategories(cats)
    }

    loadProducts({ country, currency, locale }, (products) => {
      const cats = [...new Set(products.map((p) => p.category))].filter(Boolean).sort()
      if (cats.length) setCategories(cats)
    }).catch(() => {})
  }, [country, currency, locale])

  const closeMenus = useCallback(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [])

  const runSearch = (e) => {
    e?.preventDefault()
    closeMenus()
    const q = searchQuery.trim()
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (activeCategory && !q) params.set('category', activeCategory)
    params.delete('page')
    navigate(params.toString() ? `/?${params.toString()}` : '/')
  }

  const goToCategory = (category) => {
    closeMenus()
    navigate(`/?category=${encodeURIComponent(category)}`)
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-store-page text-store-body">
        <div className="fixed right-4 top-4 z-50">
          <ThemeToggle className="bg-store-surface border border-store shadow-sm" />
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-store-page text-store-body">
      <div className="bg-gradient-to-r from-[#1e3a5f] via-[#2d4a73] to-[#1e3a5f] text-center text-xs text-white/90 sm:text-sm">
        <div className="store-container flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-2.5">
          <span className="inline-flex items-center gap-1.5">
            <Zap size={13} className="text-[#fbbf24]" />
            Digital superfast delivery
          </span>
          <span className="hidden sm:inline text-white/30">|</span>
          <span className="inline-flex items-center gap-1.5">
            <Shield size={13} className="text-[#4ade80]" />
            Genuine licenses
          </span>
          <span className="hidden md:inline text-white/30">|</span>
          <span className="hidden md:inline">WhatsApp support available</span>
        </div>
      </div>

      <header className="header-surface sticky top-0 z-50 shadow-sm">
        <div className="store-container flex items-center gap-4 py-3.5">
          <button
            type="button"
            className="rounded-full p-2 hover:bg-store-hover lg:hidden transition-colors"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <StoreLogo onClick={closeMenus} />

          <form onSubmit={runSearch} className="hidden flex-1 md:flex" role="search">
            <div className="flex w-full max-w-xl overflow-hidden rounded-full border border-store bg-store-subtle shadow-inner transition-shadow focus-within:border-[#f97316]/50 focus-within:shadow-md">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="flex-1 bg-transparent px-5 py-2.5 text-sm text-store-body outline-none placeholder:text-store-muted"
                aria-label="Search products"
              />
              <button type="submit" className="m-1 rounded-full bg-gradient-to-r from-[#f97316] to-[#ea580c] px-5 text-white hover:brightness-105 transition-all" aria-label="Search">
                <Search size={18} />
              </button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-full p-2.5 hover:bg-store-hover md:hidden transition-colors"
              aria-label="Open search"
            >
              <Search size={20} />
            </button>
            <Link
              to="/support"
              className={`hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors md:flex ${location.pathname === '/support' ? 'bg-store-primary-muted text-[#f97316]' : 'hover:bg-store-hover hover:text-[#f97316]'}`}
            >
              <Headphones size={18} /> {t('support')}
            </Link>
            <Link
              to="/account"
              className={`hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors md:flex ${location.pathname === '/account' ? 'bg-store-primary-muted text-[#f97316]' : 'hover:bg-store-hover hover:text-[#f97316]'}`}
            >
              <User size={18} /> {t('account')}
            </Link>
            <button type="button" className="hidden rounded-full p-2.5 hover:bg-store-hover sm:block transition-colors" aria-label="Wishlist">
              <Heart size={20} className="text-store-muted" />
            </button>
            {user ? (
              <Link
                to="/orders"
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-store-primary-muted hover:text-[#f97316] ${location.pathname === '/orders' ? 'bg-store-primary-muted text-[#f97316]' : ''}`}
              >
                <Package size={20} />
                <span className="hidden sm:inline">My orders</span>
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-store-primary-muted hover:text-[#f97316]"
              aria-label={`Shopping cart, ${itemCount} items`}
            >
              <ShoppingCart size={20} />
              <span className="hidden sm:inline">{itemCount} items</span>
              {itemCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] text-[10px] font-bold text-white shadow-md sm:static sm:h-auto sm:w-auto sm:rounded-none sm:bg-transparent sm:text-inherit sm:shadow-none">
                  {itemCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        <nav className="hidden border-t border-store md:block" aria-label="Main navigation">
          <div className="store-container flex items-center gap-4 py-2.5">
            <div className="flex shrink-0 items-center gap-5 text-sm font-medium">
              <Link to="/" className={navLinkClass(isShopHome)}>{t('shop')}</Link>
              <Link to="/about" className={navLinkClass(location.pathname === '/about')}>{t('about')}</Link>
              <Link to="/guides" className={navLinkClass(location.pathname.startsWith('/guides'))}>Guides</Link>
              <Link to="/support" className={navLinkClass(location.pathname === '/support')}>{t('support')}</Link>
              <Link to="/checkout" className={navLinkClass(location.pathname === '/checkout')}>{t('checkout')}</Link>
            </div>
            {categories.length > 0 ? (
              <>
                <span className="hidden h-4 w-px shrink-0 bg-store-border lg:block" aria-hidden />
                <div className="category-scroll min-w-0 flex-1">
                  {categories.map((cat) => (
                    <Link
                      key={cat}
                      to={`/?category=${encodeURIComponent(cat)}`}
                      className={`category-chip text-sm ${activeCategory === cat ? 'active' : ''}`}
                    >
                      {cat}
                    </Link>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </nav>

        {menuOpen ? (
          <nav className="mobile-menu-panel border-t border-store px-4 py-4 lg:hidden animate-fade-in-up" aria-label="Mobile navigation">
            <div className="flex flex-col gap-0.5 text-sm">
              <Link to="/" className={`rounded-lg px-3 py-2.5 ${navLinkClass(isShopHome)}`} onClick={closeMenus}>
                Shop
              </Link>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => goToCategory(cat)}
                  className={`rounded-lg px-3 py-2.5 text-left ${navLinkClass(activeCategory === cat)}`}
                >
                  {cat}
                </button>
              ))}
              <Link
                to="/guides"
                className={`rounded-lg px-3 py-2.5 ${navLinkClass(location.pathname.startsWith('/guides'))}`}
                onClick={closeMenus}
              >
                Guides
              </Link>
              <Link
                to="/support"
                className={`rounded-lg px-3 py-2.5 ${navLinkClass(location.pathname === '/support')}`}
                onClick={closeMenus}
              >
                Support
              </Link>
              <Link
                to="/about"
                className={`rounded-lg px-3 py-2.5 ${navLinkClass(location.pathname === '/about')}`}
                onClick={closeMenus}
              >
                About Us
              </Link>
              <Link
                to="/checkout"
                className={`rounded-lg px-3 py-2.5 ${navLinkClass(location.pathname === '/checkout')}`}
                onClick={closeMenus}
              >
                Checkout
              </Link>
              {user ? (
                <Link
                  to="/orders"
                  className={`rounded-lg px-3 py-2.5 ${navLinkClass(location.pathname === '/orders')}`}
                  onClick={closeMenus}
                >
                  My orders
                </Link>
              ) : null}
              <Link
                to="/account"
                className={`rounded-lg px-3 py-2.5 ${navLinkClass(location.pathname === '/account')}`}
                onClick={closeMenus}
              >
                My account
              </Link>
            </div>
          </nav>
        ) : null}
      </header>

      {searchOpen ? (
        <div className="fixed inset-0 z-[90] bg-store-surface/95 backdrop-blur-sm p-4 md:hidden animate-fade-in-up">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-store-heading">Search products</h2>
            <button type="button" onClick={() => setSearchOpen(false)} className="rounded-full p-2 hover:bg-store-hover" aria-label="Close search">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={runSearch} role="search">
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Start typing to see products..."
              className="store-input"
              aria-label="Search products"
            />
          </form>
        </div>
      ) : null}

      <main className={`main-with-mobile-nav ${isProductDetail ? 'product-detail-page' : ''}`}>{children}</main>

      <footer className="footer-with-mobile-nav mt-20 border-t border-store bg-gradient-to-b from-[#1e3a5f] to-[#152a45] text-white">
        <div className="store-container footer-grid grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <StoreLogo className="h-8 w-auto max-w-[180px]" light />
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Genuine software licenses at discount prices with instant email delivery and dedicated support.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="trust-pill text-white/90">
                <Sparkles size={12} /> 142+ products
              </span>
              <span className="trust-pill text-white/90">
                <Shield size={12} /> Secure checkout
              </span>
            </div>
          </div>
          <div>
            <p className="font-semibold text-white/90">Shop</p>
            <ul className="mt-4 space-y-2.5 text-sm text-white/60">
              <li><Link to="/" className="hover:text-[#f97316] transition-colors">All products</Link></li>
              <li><Link to="/about" className="hover:text-[#f97316] transition-colors">About Us</Link></li>
              {categories.map((cat) => (
                <li key={cat}>
                  <Link to={`/?category=${encodeURIComponent(cat)}`} className="hover:text-[#f97316] transition-colors">{cat}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-3 sm:order-3 lg:order-3">
            <p className="font-semibold text-white/90">Contact us</p>
            <ul className="mt-4 space-y-2.5 text-sm text-white/60">
              <li><Link to="/guides" className="hover:text-[#f97316] transition-colors">Guides & tutorials</Link></li>
              <li><Link to="/support" className="hover:text-[#f97316] transition-colors">Help center</Link></li>
              <li><a href={MAILTO_URL} className="hover:text-[#f97316] transition-colors">{SUPPORT_EMAIL}</a></li>
              <li>
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="hover:text-[#f97316] transition-colors">
                  WhatsApp: {SUPPORT_PHONE}
                </a>
              </li>
              <li>{SUPPORT_ADDRESS}</li>
            </ul>
          </div>
          <div className="order-4 sm:order-4 lg:order-4">
            <p className="font-semibold text-white/90">Legal</p>
            <ul className="mt-4 space-y-2.5 text-sm text-white/60">
              <li><Link to="/terms" className="hover:text-[#f97316] transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/payment-policy" className="hover:text-[#f97316] transition-colors">Payment Policy</Link></li>
              <li><Link to="/delivery-policy" className="hover:text-[#f97316] transition-colors">Delivery Policy</Link></li>
              <li><Link to="/returns-refunds" className="hover:text-[#f97316] transition-colors">Returns & Refunds</Link></li>
            </ul>
          </div>
          <div className="order-5 sm:order-5 lg:order-5">
            <p className="font-semibold text-white/90">Account</p>
            <ul className="mt-4 space-y-2.5 text-sm text-white/60">
              <li><Link to="/account" className="hover:text-[#f97316] transition-colors">My account</Link></li>
              <li><Link to="/checkout" className="hover:text-[#f97316] transition-colors">Checkout</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">
          © {new Date().getFullYear()} eSoftwareStore.com — Discount Software Licenses
        </div>
      </footer>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        currency={currency}
        onRemove={removeFromCart}
      />
      <ChatWidget />
      <MobileBottomNav
        itemCount={itemCount}
        onCart={() => setCartOpen(true)}
        user={user}
      />
    </div>
  )
}
