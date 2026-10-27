import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Common — Identity & access, in order.',description:'A standalone multi-tenant identity and authorization platform.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {return <html lang="en"><body>{children}</body></html>;}
