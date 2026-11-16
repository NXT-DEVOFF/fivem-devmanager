import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FiveM DevManager",
    template: "%s · FiveM DevManager",
  },
  description:
    "Plateforme centralisee de developpement, de gestion et de supervision d'un serveur FiveM.",
  applicationName: "FiveM DevManager",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#090B10",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-bg text-fg antialiased">
        <div className="relative z-[1]">{children}</div>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#151B26",
              border: "1px solid #252D3B",
              color: "#F8FAFC",
            },
          }}
        />
      </body>
    </html>
  );
}
