import { type Orador } from "../database";

interface OradorCardProps {
  orador: Orador;
  ultimaData: string;
  onClick: () => void;
  isAtivo: boolean;
}

function OradorCard({ orador, ultimaData, onClick, isAtivo }: OradorCardProps) {
  return (
    <li
      onClick={onClick}
      className={`my-3 p-4 rounded-xl border-l-4 cursor-pointer flex justify-between items-center transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
        isAtivo
          ? "bg-sky-50 border-purple-500 hover:bg-purple-100"
          : "bg-sky-50 border-gray-400 hover:bg-gray-100 opacity-75"
      }`}
    >
      <div className="flex items-center gap-2">
        <strong
          className={`text-xl font-bold ${
            isAtivo ? "text-purple-900" : "text-gray-700"
          }`}
        >
          {orador.nome}
        </strong>
        {!isAtivo && (
          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
            Inativo
          </span>
        )}
      </div>
      <span
        className={`text-sm px-3 py-1 rounded-full font-medium ${
          isAtivo
            ? "text-purple-800 bg-purple-200"
            : "text-gray-700 bg-gray-200"
        }`}
      >
        {ultimaData}
      </span>
    </li>
  );
}

export default OradorCard;
