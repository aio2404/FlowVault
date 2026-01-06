import type { Metadata } from 'next';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/toast';
import { ThemeProvider } from '@/components/theme-provider';
import { LanguageProvider } from '@/lib/i18n';

const dmSans = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'FlowVault - The Vault for Your Automation Workflows',
  description: 'Automatic versioning, visual diffs, and one-click rollback for n8n, Make, Activepieces and more.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <LanguageProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
