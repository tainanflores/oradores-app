# Sistema de Gerenciamento de Oradores – Requisitos e Análise de Software

## 1. Visão Geral

Este sistema tem como objetivo auxiliar o gerenciamento de oradores e discursos em uma congregação, contemplando:
- Oradores locais (que discursam internamente e externamente)
- Oradores visitantes (que discursam na congregação local)
- Agenda de discursos de fim de semana
- Controle de temas, datas especiais e conflitos

O sistema será desenvolvido como um **PWA (Progressive Web App)**, podendo ser instalado em computador e celular, funcionando offline e com sincronização simples via Google Drive.

---

## 2. Escopo do Sistema

### 2.1 O sistema permitirá:
- Cadastro e gerenciamento de oradores
- Cadastro e gerenciamento de temas
- Agenda de discursos na congregação
- Agenda de saídas de oradores locais
- Bloqueio de datas especiais (Assembleia, Congresso, Celebração)
- Bloqueio temporário de temas
- Histórico de discursos
- Backup e sincronização automática

### 2.2 Fora do escopo (por enquanto):
- Controle de usuários/login
- Exportação de dados
- Envio automático de mensagens

---

## 3. Requisitos Funcionais (RF)

### Oradores
- **RF-01**: Cadastrar orador com nome, telefone, congregação, cidade, tipo (local/visitante), ativo/inativo e observações
- **RF-02**: Editar dados do orador
- **RF-03**: Inativar orador sem apagar histórico
- **RF-04**: Visualizar histórico de discursos do orador

### Temas
- **RF-05**: Manter lista base de temas (número, nome, título)
- **RF-06**: Permitir atualização de título ou inclusão de novos temas
- **RF-07**: Bloquear temas por período/ano (ex.: temas reservados ao superintendente viajante)

### Relação Orador ⇄ Tema
- **RF-08**: Associar temas preparados a cada orador
- **RF-09**: Editar manualmente a lista de temas preparados do orador
- **RF-10**: Ao registrar um discurso, adicionar automaticamente o tema ao cadastro do orador (se ainda não existir)

### Agenda de Discursos (Congregação)
- **RF-11**: Visualizar agenda semanal e mensal apenas com datas relevantes
- **RF-12**: Registrar discurso com data, orador, tema e congregação de origem
- **RF-13**: Impedir cadastro em datas especiais

### Agenda de Saídas (Oradores Locais)
- **RF-14**: Registrar saída com data, orador, tema e congregação de destino
- **RF-15**: Alertar conflito se mais de um orador local sair no mesmo dia

### Datas Especiais
- **RF-16**: Cadastrar datas especiais (Assembleia, Congresso, Celebração)
- **RF-17**: Bloquear automaticamente discursos e saídas nessas datas

### Backup e Sincronização
- **RF-18**: Salvar dados localmente (IndexedDB)
- **RF-19**: Gerar backup automático ao fechar o app
- **RF-20**: Verificar e restaurar backup ao abrir o app

---

## 4. Requisitos Não Funcionais (RNF)

- **RNF-01**: Aplicação PWA instalável
- **RNF-02**: Funcionamento offline
- **RNF-03**: Interface responsiva
- **RNF-04**: Simplicidade de uso
- **RNF-05**: Sem custos recorrentes

---

## 5. Regras de Negócio (RN)

- **RN-01**: Um discurso só pode usar temas preparados pelo orador
- **RN-02**: Temas bloqueados não podem ser usados em discursos
- **RN-03**: Datas especiais bloqueiam qualquer discurso ou saída
- **RN-04**: Um orador pertence a apenas uma congregação por vez
- **RN-05**: Não pode haver mais de uma saída de orador local no mesmo dia (ou deve haver alerta)

---

## 6. Modelo de Dados (Entidades Principais)

### Orador
- id
- nome
- telefone
- congregacao
- cidade
- tipo (local/visitante)
- ativo
- observacoes

### Tema
- id
- numero
- titulo
- ativo

### OradorTema
- id
- oradorId
- temaId

### Discurso
- id
- data
- oradorId
- temaId
- tipo (local/visitante)

### SaidaOrador
- id
- data
- oradorId
- temaId
- congregacaoDestino

### DataEspecial
- id
- data
- tipo (assembleia, congresso, celebracao)

### TemaBloqueado
- id
- temaId
- ano

---

## 7. UML (Descrição Textual)

- Orador 1..* Discurso
- Orador 1..* SaidaOrador
- Orador *..* Tema (via OradorTema)
- Tema 1..* Discurso
- Tema 1..* SaidaOrador
- DataEspecial bloqueia Discurso e SaidaOrador

---

## 8. Arquitetura Técnica Recomendada (PWA)

### Stack
- Frontend: React + TypeScript
- Armazenamento local: IndexedDB
- Backup: Google Drive (App Folder)
- Build: Vite
- PWA: Workbox

---

## 9. Próximas Etapas (4 Opções)

### Opção 1 – Arquitetura Técnica Detalhada
- Estrutura de pastas
- Fluxo de dados
- Estratégia offline-first

### Opção 2 – UX / Telas do Sistema
- Wireframes
- Fluxos de navegação
- Componentes principais

### Opção 3 – Modelo de Dados em JSON
- Estruturas prontas para IndexedDB
- Versionamento de dados

### Opção 4 – Sincronização com Google Drive
- Estratégia de backup
- Detecção de conflitos
- Fluxo automático de restauração

---

## 10. Observação Final

Este documento foi pensado para servir como base direta para desenvolvimento com auxílio de ferramentas como GitHub Copilot, mantendo clareza, simplicidade e aderência total à prática real da congregação.

