import '../styles/global.css'
// Back/Forward scroll restore for every page (installs its router listeners on import).
import '../lib/scroll-memory'
import type { AppProps } from 'next/app'
import { AuthProvider } from '../lib/auth'
import { AuthModalProvider } from '../lib/auth-modal'
import { CartProvider } from '../lib/cart'
import { FavoritesProvider } from '../lib/favorites'
import { LanguageProvider } from '../lib/i18n'
import { ShellProvider } from '../lib/shell'
import NotificationToasts from '../components/NotificationToasts'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AuthModalProvider>
        <ShellProvider>
          <FavoritesProvider>
            <CartProvider>
              <Component {...pageProps} />
              <NotificationToasts />
            </CartProvider>
          </FavoritesProvider>
        </ShellProvider>
        </AuthModalProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
