/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'

// "როგორ მუშაობს Escrow?" on the listing page (design 2026-10-04, screenshot "listing"): the five
// money steps for this kind of product, then the three things a buyer should know.
type Kind = 'account' | 'skin' | 'item' | 'service' | 'key'

const ICONS: Record<string, JSX.Element> = {
  pay: <img src="/assets/ui/card-light.png" alt="" />,
  lock: (
    <svg viewBox="0 0 24 24">
      <rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  send: <img src="/assets/ui/send-light.png" alt="" />,
  search: (
    <svg viewBox="0 0 24 24">
      <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m15 15 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  check: <img src="/assets/ui/check-circle-light.png" alt="" />,
}

function stepsFor(kind: Kind): Array<[string, string]> {
  const third =
    kind === 'service' ? 'გამყიდველი ასრულებს სერვისს' : kind === 'key' ? 'გასაღებს მყისიერად იღებთ' : 'გამყიდველი გიგზავნის ლოგინს და პაროლს'
  const fourth = kind === 'service' ? 'თქვენ ამოწმებთ შედეგს' : kind === 'key' ? 'თქვენ ააქტიურებთ და ამოწმებთ' : kind === 'account' ? 'თქვენ ამოწმებთ ანგარიშს' : 'თქვენ ამოწმებთ ნივთს'
  return [
    ['pay', 'მყიდველი იხდის თანხას'],
    ['lock', 'თანხა იყინება (არ გადადის გამყიდველთან)'],
    ['send', third],
    ['search', fourth],
    ['check', 'დადასტურების შემდეგ თანხა გადადის გამყიდველთან'],
  ]
}

export default function EscrowExplainer({ kind }: { kind: Kind }) {
  return (
    <section className="ex-box" aria-labelledby="escrowExplainerTitle">
      <header className="ex-head">
        <span className="ex-shield">
          <img src="/assets/ui/shield-check.png" alt="" aria-hidden="true" />
        </span>
        <div>
          <h2 id="escrowExplainerTitle">
            როგორ მუშაობს <span>Escrow</span> ?
          </h2>
          <p>უსაფრთხო ყიდვა-გაყიდვის პროცესი</p>
        </div>
      </header>
      <ol className="ex-steps">
        {stepsFor(kind).map(([icon, text], i) => (
          <li key={text}>
            <b>{i + 1}</b>
            <span className="ex-step-icon" aria-hidden="true">
              {ICONS[icon]}
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <h3>მნიშვნელოვანი ინფორმაცია</h3>
      <div className="ex-info">
        <Link href="/support">
          <img src="/assets/ui/headset.png" alt="" aria-hidden="true" />
          <span>
            <strong>თუ პრობლემა შეგექმნათ?</strong>
            <small>ჩვენი გუნდი დაგეხმარებათ შეკვეთის ნებისმიერ ეტაპზე.</small>
          </span>
          <i aria-hidden="true">›</i>
        </Link>
        <Link href="/pages/dispute-resolution">
          <img src="/assets/ui/doc-pink.png" alt="" aria-hidden="true" />
          <span>
            <strong>დავის გახსნა შეგიძლიათ</strong>
            <small>{kind === 'service' ? 'შედეგის შემოწმების შემდეგ, სანამ მიღებას დაადასტურებთ.' : 'შემოწმების შემდეგ, სანამ მის მიღებას დაადასტურებთ.'}</small>
          </span>
          <i aria-hidden="true">›</i>
        </Link>
        <Link href="/pages/refund-policy">
          <img src="/assets/ui/shield-check.png" alt="" aria-hidden="true" />
          <span>
            <strong>თუ მიღებას არ ადასტურებთ</strong>
            <small>თუ 24 საათის განმავლობაში არ დაადასტურებთ შეკვეთას ან არ გახსნით დავას, შეკვეთა ავტომატურად ჩაითვლება დასრულებულად.</small>
          </span>
          <i aria-hidden="true">›</i>
        </Link>
      </div>
    </section>
  )
}
