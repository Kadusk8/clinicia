export default function PatientsPage() {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Pacientes</h1>
          <p className="text-surface-500 mt-1">Gerencie seus pacientes</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <span>+</span>
          Novo Paciente
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou CPF..."
          className="input flex-1"
        />
        <select className="input w-48">
          <option value="">Todos os tags</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="text-left px-6 py-4">Nome</th>
              <th className="text-left px-6 py-4">Telefone</th>
              <th className="text-left px-6 py-4">E-mail</th>
              <th className="text-left px-6 py-4">Convênio</th>
              <th className="text-left px-6 py-4">Cadastro</th>
              <th className="text-right px-6 py-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="text-center py-16 text-surface-400">
                <span className="text-4xl mb-3 block">👥</span>
                <p>Nenhum paciente cadastrado</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
