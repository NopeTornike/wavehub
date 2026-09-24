/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useCart } from '../lib/cart'

// auth.html's `.auth-card-top`: the WaveHubX logo back to home and the cart shortcut with its live
// count (the cart is browser-local, so it works signed out too). Shared by every auth page.
export default function AuthCardTop() {
  const { count } = useCart()
  return (
    <div className="auth-card-top">
      <Link className="auth-brand" href="/" aria-label="WaveHub — მთავარი გვერდი">
        <img src="/assets/logo-wavehubx-main.png" alt="WaveHubX" width={600} height={310} />
      </Link>
      <Link className="auth-cart-link" href="/cart" aria-label="კალათა" title="კალათა">
        <img className="cart-icon-image" src="/assets/cart-icon.png" alt="" aria-hidden="true" />
        <strong className="cart-badge" data-cart-count="">
          {count}
        </strong>
      </Link>
    </div>
  )
}
