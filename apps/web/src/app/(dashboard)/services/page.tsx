export default function ServicesPage() {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Serviços</h1>
          <p className="text-surface-500 mt-1">Serviços oferecidos pela clínica</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <span>+</span>
          Novo Serviço
        </button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card-interactive p-6 border-2 border-dashed border-surface-200 flex flex-col items-center justify-center min-h-[200px] text-surface-400">
          <span className="text-4xl mb-3">🩺</span>
          <p className="font-medium">Adicionar serviço</p>
          <p className="text-sm mt-1">Cadastre consultas, exames e procedimentos</p>
        </div>
      </div>
    </div>
  );
}
