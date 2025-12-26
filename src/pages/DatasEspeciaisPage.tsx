function DatasEspeciaisPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        🎯 Datas Especiais
      </h1>
      <p className="text-gray-600 mb-4">
        Gerencie assembleias, congressos, eventos transmitidos e outras datas
        especiais.
      </p>

      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-2">Próximas Datas Especiais</h3>
        <p className="text-gray-500">Nenhuma data especial cadastrada</p>
      </div>

      <button className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
        + Adicionar Data Especial
      </button>
    </div>
  );
}

export default DatasEspeciaisPage;
