import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './i18n'
import { prefetchStaticCatalog } from './lib/products'
import { prefetchStaticGuides } from './lib/guides'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'

prefetchStaticCatalog()
prefetchStaticGuides()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)
