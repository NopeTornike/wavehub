/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useRouter } from 'next/router'
import PageHead from '../components/PageHead'
import AuthShell from '../components/auth/AuthShell'
import LoginForm, { safeNextPath } from '../components/auth/LoginForm'

// The /login page (links carrying `?next=`); the topbar opens the same form as a drawer instead.
// Owner design 2026-10-15.
export default function Login() {
  const router = useRouter()
  return (
    <AuthShell
      topAction={
        <Link className="ax-top-link" href="/register">
          რეგისტრაცია
        </Link>
      }
    >
      <PageHead title="შესვლა" description="შედით თქვენს WaveHubX ანგარიშზე." noIndex />
      <img className="ax-logo" src="/assets/logo-wavehubx-main.png" alt="WaveHubX" />
      <h1 className="ax-heading">შესვლა</h1>
      <p className="ax-lead">კეთილი იყოს შენი დაბრუნება! შედი WaveHubX ანგარიშზე და განაგრძე გეიმინგ მოგზაურობა.</p>
      <LoginForm next={safeNextPath(router.query.next) || '/'} />
    </AuthShell>
  )
}
