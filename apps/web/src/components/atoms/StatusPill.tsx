import type {ReactNode} from 'react'
export function StatusPill({children,tone='neutral'}:{children:ReactNode,tone?:'neutral'|'positive'|'warning'}) { return <span className={'novzi-status-pill tone-'+tone}>{children}</span> }
