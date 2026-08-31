import type { Metadata } from "next";
import "./globals.css";
import "./overrides.css";
export const metadata: Metadata = { title: "Garantías Express | Centro de operación", description: "Operación integral, multisucursal y trazabilidad centralizada del proceso de garantías." };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
