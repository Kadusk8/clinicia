import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-950 via-primary-950 to-surface-950 flex items-center justify-center">
      <div className="text-center animate-fade-in">
        {/* Logo / Brand */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary-500 to-accent-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-primary-500/20 mb-6">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-white mb-3">
            Clinic<span className="text-primary-400">IA</span>
          </h1>
          <p className="text-surface-400 text-lg max-w-md mx-auto">
            CRM inteligente com agente IA no WhatsApp para clínicas médicas e odontológicas
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="btn-primary text-lg px-8 py-3"
          >
            Entrar
          </Link>
          <Link
            href="/admin/login"
            className="px-8 py-3 rounded-xl text-lg font-medium text-white border border-surface-600 hover:bg-surface-800 transition-all duration-200"
          >
            Admin
          </Link>
        </div>

        {/* Features Preview */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            {
              icon: '🤖',
              title: 'Agente IA',
              desc: 'Atende pacientes 24/7 pelo WhatsApp',
            },
            {
              icon: '📅',
              title: 'Agendamento',
              desc: 'Agenda automática com confirmação',
            },
            {
              icon: '📊',
              title: 'Pipeline CRM',
              desc: 'Acompanhe leads e conversões',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="glass-dark rounded-2xl p-6 text-left animate-slide-up"
            >
              <span className="text-3xl mb-3 block">{feature.icon}</span>
              <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
              <p className="text-surface-400 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
