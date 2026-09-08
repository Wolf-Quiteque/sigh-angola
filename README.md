# SIGH-ANGOLA

Demonstração do Sistema Integrado de Gestão Hospitalar de Angola. Interface branca, português de Angola e processos com dados fictícios em JSON. Construção por fases, a partir dos três documentos originais deste directório.

## Iniciar

Requer Node.js 20.9 ou superior. O desenvolvimento foi validado com Node 22.

```powershell
npm.cmd install
npm.cmd run dev
```

Abrir [http://localhost:3000](http://localhost:3000). No Windows, `npm.cmd` evita o bloqueio de `npm.ps1` por políticas do PowerShell. Em outras shells, pode usar `npm`.

```powershell
npm.cmd run build
npm.cmd run start
```

## Entrega actual: fases 0 e 1

- Painel de recepção com indicadores calculados dos dados.
- Pesquisa, filtros, paginação, registo e edição de pacientes; ficha demográfica e histórico.
- Marcações, confirmação, reagendamento, cancelamento justificado e chegada.
- Admissão sem marcação e fila de pacientes que aguardam triagem.
- Validação de duplicados, referências, sobreposição de horários e episódios activos.
- Perfis de demonstração, permissões no domínio e auditoria de alterações.
- Persistência local entre recarregamentos, exportação JSON e reposição do cenário.
- Navegação responsiva, diálogos com foco e mensagens de erro.

O perfil é seleccionado no cabeçalho. Administrador e Recepcionista podem operar a recepção; Direcção consulta em modo de leitura. A sessão demo regressa ao Administrador ao recarregar.

## Percurso de demonstração

1. Em **Pacientes**, criar um paciente fictício.
2. Abrir a ficha e escolher **Marcar consulta**; seleccionar um horário livre para hoje.
3. Na **Agenda de consultas**, confirmar a marcação e registar a **Chegada**.
4. Em **Fila de atendimento**, encontrar o paciente a aguardar triagem.
5. Recarregar a página e verificar a persistência.
6. Consultar **Registo de actividade** para ver as operações.
7. Em **Configurações**, exportar o JSON ou repor o cenário com confirmação.

Triagem e consulta clínica serão implementadas na fase 2. Os módulos restantes têm âmbito e critérios de aceitação no [roteiro](docs/ROADMAP.md), também disponível no ecrã **Roteiro da plataforma**.

## Estrutura

```text
src/app/          Rotas Next.js e tokens/estilos
src/components/   Shell e componentes partilhados
src/features/     Ecrãs de cada capacidade
src/domain/       Tipos, validação, regras e estados
src/data/         Dataset JSON fictício
src/lib/          Repositório local, contexto e formatação
tests/            Testes de domínio e de navegador
docs/             Roteiro, arquitectura e verificação
```

O repositório é a fronteira para uma futura API. Nenhum ecrã faz chamadas a uma API hospitalar. A aplicação Next.js serve as páginas e os ficheiros normalmente, incluindo pedidos internos de navegação.

## Dados e limites

`src/data/demo.json` contém pacientes, profissionais, unidade, marcações e episódios. Os nomes e contactos são fictícios; os documentos usam prefixos de demonstração. Datas relativas são convertidas no primeiro carregamento, conservando-se até repor os dados.

Os dados são guardados na chave `sigh-angola-demo-v1` de localStorage. Alterações só são consideradas bem-sucedidas depois da gravação. Web Locks evita gravações simultâneas entre separadores; a revisão rejeita alterações de um estado obsoleto. Abra a demo em localhost ou num contexto HTTPS compatível.

Não inclui autenticação real, sincronização, abertura a frio offline, prontuário completo ou integrações. Dados locais não são encriptados nem partilhados entre dispositivos. A exportação é uma cópia JSON; importação/restauro está prevista na fase 8. Esta fase não usa dados reais de pacientes.

## Verificações

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Os testes de navegador iniciam o servidor de produção na porta 3100 e usam contextos isolados. Capturas de desktop, tablet e telemóvel são geradas em `test-results/`. Consulte [VALIDATION.md](docs/VALIDATION.md) para o resultado observado.

Referências de projecto: [arquitectura](docs/ARCHITECTURE.md), [roteiro completo](docs/ROADMAP.md) e [requisitos extraídos](docs/source-requirements.txt). Os três ficheiros originais permanecem intactos.
