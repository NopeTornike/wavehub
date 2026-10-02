import '../styles/global.css'
import type { AppProps } from 'next/app'
import { AuthProvider } from '../lib/auth'
import { CartProvider } from '../lib/cart'
import { FavoritesProvider } from '../lib/favorites'
import { LanguageProvider } from '../lib/i18n'
import { ShellProvider } from '../lib/shell'
import NotificationToasts from '../components/NotificationToasts'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ShellProvider>
          <FavoritesProvider>
            <CartProvider>
              <Component {...pageProps} />
              <NotificationToasts />
            </CartProvider>
          </FavoritesProvider>
        </ShellProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
