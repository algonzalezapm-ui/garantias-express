import type { Metadata } from "next";
import "./globals.css";
import "./overrides.css";
export const metadata: Metadata = { title: "Garantías Express | Centro de operación", description: "Operación integral, multisucursal y trazabilidad centralizada del proceso de garantías." };
const entornoPruebaBadgeStyle: React.CSSProperties = {
  position: "fixed",
  top: 1,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 999999,
  pointerEvents: "none",
  background: "#fff3e3",
  color: "#965a19",
  borderRadius: 20,
  padding: "1px 9px",
  fontSize: 8,
  lineHeight: "8px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  fontFamily: "Inter, ui-sans-serif, system-ui, 'Segoe UI', sans-serif",
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><span style={entornoPruebaBadgeStyle}>Entorno de prueba</span>{children}</body></html>}
