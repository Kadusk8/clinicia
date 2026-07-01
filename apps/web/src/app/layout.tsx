import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/auth-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CRM Clínicas — Gestão + IA WhatsApp',
  description:
    'CRM inteligente para clínicas médicas e odontológicas. Agente IA no WhatsApp, agendamento automático, pipeline de vendas e follow-up.',
  keywords: 'CRM, clínicas, IA, WhatsApp, agendamento, saúde',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-surface-950 text-surface-50 antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
