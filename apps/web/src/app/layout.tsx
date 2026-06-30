import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
