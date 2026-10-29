/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { usePlatformTimings } from '../lib/timings'
import { StepTimeline, type StepIcon } from './StepsGuide'

// "როგორ მუშაობს Escrow?" on the listing page (design 2026-10-04, screenshot "listing"): the five
// money steps for this kind of product, then the three things a buyer should know.
type Kind = 'account' | 'skin' | 'item' | 'service' | 'key'

function stepsFor(kind: Kind): Array<{ text: string; icon: StepIcon }> {
  const third =
    kind === 'service' ? 'გამყიდველი ასრულებს სერვისს' : kind === 'key' ? 'გასაღებს მყისიერად იღებთ' : 'გამყიდველი გიგზავნის ლოგინს და პაროლს'
  const fourth = kind === 'service' ? 'თქვენ ამოწმებთ შედეგს' : kind === 'key' ? 'თქვენ ააქტიურებთ და ამოწმებთ' : kind === 'account' ? 'თქვენ ამოწმებთ ანგარიშს' : 'თქვენ ამოწმებთ ნივთს'
  return [
    { text: 'მყიდველი იხდის თანხას', icon: 'card' },
    { text: 'თანხა იყინება (არ გადადის გამყიდველთან)', icon: 'lock' },
    { text: third, icon: kind === 'service' ? 'package' : kind === 'key' ? 'key' : 'send' },
    { text: fourth, icon: 'search' },
    { text: 'დადასტურების შემდეგ თანხა გადადის გამყიდველთან', icon: 'wait' },
  ]
}

export default function EscrowExplainer({ kind }: { kind: Kind }) {
  const timings = usePlatformTimings()
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
      <StepTimeline steps={stepsFor(kind)} />
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
            <small>
              {timings
                ? `თუ ${timings.orderAutoCompleteHours} საათის განმავლობაში არ დაადასტურებთ შეკვეთას ან არ გახსნით დავას, შეკვეთა ავტომატურად ჩაითვლება დასრულებულად.`
                : 'თუ მიღებას არ დაადასტურებთ და არც დავას გახსნით, შეკვეთა გარკვეული დროის შემდეგ ავტომატურად დასრულდება.'}
            </small>
          </span>
          <i aria-hidden="true">›</i>
        </Link>
      </div>
    </section>
  )
}
