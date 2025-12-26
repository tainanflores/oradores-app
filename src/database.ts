import Dexie, { type Table } from "dexie";

// Interfaces para as entidades do banco de dados
export interface Orador {
  id?: number; // Opcional, pois será gerado automaticamente
  nome: string;
  telefone: string;
  congregacao: string;
  cidade: string;
  tipo: "local" | "visitante"; // Só aceita esses valores
  ativo: boolean;
  observacoes?: string; // Opcional
}

export interface Tema {
  id?: number;
  numero: number;
  titulo: string;
  ativo: boolean;
}

export interface OradorTema {
  id?: number;
  oradorId: number;
  temaId: number;
}

export interface Discurso {
  id?: number;
  data: string; // Data em formato ISO (ex.: '2023-12-25')
  oradorId: number;
  temaId: number;
  tipo: "local" | "visitante";
}

export interface SaidaOrador {
  id?: number;
  data: string;
  oradorId: number;
  temaId: number;
  congregacaoDestino: string;
  cidade?: string;
}

export interface DataEspecial {
  id?: number;
  data: string;
  tipo: "assembleia" | "congresso" | "celebracao" | "evento_transmitido";
}

export interface TemaBloqueado {
  id?: number;
  temaId: number;
  ano: number;
}

export interface Configuracao {
  id?: number; // Sempre será 1 (único registro)
  nomeCongregacao: string;
  diaReuniao: string; // 'domingo', 'segunda', etc.
  horarioReuniao: string; // formato HH:MM
  endereco?: string;
  telefone?: string;
  email?: string;
  cidade: string;
  autoBackup: boolean;
}

// Classe do banco de dados
export class OradoresDB extends Dexie {
  // Propriedades para cada tabela
  oradores!: Table<Orador>;
  temas!: Table<Tema>;
  oradorTemas!: Table<OradorTema>;
  discursos!: Table<Discurso>;
  saidasOrador!: Table<SaidaOrador>;
  datasEspeciais!: Table<DataEspecial>;
  temasBloqueados!: Table<TemaBloqueado>;
  configuracoes!: Table<Configuracao>;

  constructor() {
    super("OradoresDB"); // Nome do banco IndexedDB
    this.version(1).stores({
      // Define tabelas e índices (campos pesquisáveis)
      oradores: "++id, nome, tipo, ativo", // ++id = auto-incremento
      temas: "++id, numero, titulo, ativo",
      oradorTemas: "++id, oradorId, temaId",
      discursos: "++id, data, oradorId, temaId, tipo",
      saidasOrador: "++id, data, oradorId, temaId",
      datasEspeciais: "++id, data, tipo",
      temasBloqueados: "++id, temaId, ano",
      configuracoes: "++id",
    });
  }
}

// Instância do banco
export const db = new OradoresDB();
