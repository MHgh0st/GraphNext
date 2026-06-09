import Providers from "./Providers";
import "./globals.css";
import localFont from 'next/font/local'

const Vazir = localFont({
  src: "../assets/Fonts/Vazir-FD-WOL.woff2",
  weight: '400'
})

// Root layout wraps content with Providers
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body
        className={` ${Vazir.className}`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

