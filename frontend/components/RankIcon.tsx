/* eslint-disable @next/next/no-img-element */
import { waveRankIcon } from '@wavehub/shared-types'

// A Wave rank tier's icon (Tornike's rank art). Decorative next to the tier name, so alt="".
export default function RankIcon({ name, className = 'wave-rank-inline-icon', size }: { name: string | null | undefined; className?: string; size?: number }) {
  return <img className={className} src={waveRankIcon(name)} alt="" aria-hidden="true" width={size} height={size} />
}
