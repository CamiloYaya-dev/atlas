import type {ButtonHTMLAttributes,ReactNode} from 'react'
export function IconButton({children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{children:ReactNode}) {return <button className="icon-btn" type="button" {...props}>{children}</button>}
