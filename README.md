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

## Entrega actual: fases 0 a 6

- Painel de recepção com indicadores calculados dos dados.
- Pesquisa, filtros, paginação, registo e edição de pacientes; ficha demográfica e histórico.
- Marcações, confirmação, reagendamento, cancelamento justificado e chegada.
- Admissão sem marcação e fila de pacientes que aguardam triagem.
- Validação de duplicados, referências, sobreposição de horários e episódios activos.
- Perfis de demonstração, permissões no domínio e auditoria de alterações.
- Persistência local entre recarregamentos, exportação JSON e reposição do cenário.
- Navegação responsiva, diálogos com foco e mensagens de erro.
- Triagem com queixa, sinais vitais completos, observações e prioridade atribuída pelo profissional.
- Fila médica por prioridade; consulta com antecedentes, alergias, diagnóstico, procedimentos, evolução e destino.
- Prescrição estruturada e processo longitudinal, com registos finalizados protegidos e adendas rastreáveis.
- Migração automática dos dados locais das fases anteriores para o esquema actual.
- Pedidos de laboratório e imagiologia feitos na consulta, ligados ao paciente, episódio e consulta.
- Laboratório: colheita com código de amostra único, processamento, resultado e validação médica.
- Imagiologia: agendamento, realização e relatório, também com validação médica.
- Cancelamento justificado com autoria; só o resultado validado entra no processo clínico como definitivo.
- Enfermarias e mapa de camas com estados livre, ocupada, bloqueada e em manutenção.
- Consulta com destino «Internamento» coloca o paciente a aguardar cama; a admissão ocupa-a.
- Evolução, procedimentos e medicação administrada; transferência de cama numa única operação.
- Alta com tipo, referência e contrarreferência; a cama é libertada e o episódio encerrado.
- Catálogo de medicamentos, materiais, consumíveis e equipamentos, com fornecedores e lotes.
- Entradas, saídas, requisições para serviços e ajustes de inventário justificados, com saldo em cada movimento.
- Dispensação parcial ou total ligada à prescrição, com bloqueio de stock negativo e de lotes expirados.
- Alertas de stock mínimo e de validade próxima ou ultrapassada.
- Tabela de serviços em kwanzas, convénios com comparticipação e facturas de demonstração.
- Pagamentos totais ou parciais com recibo numerado, anulação justificada e caixa reconciliada.
- Colaboradores, funções e departamentos; escalas sem sobreposição e presenças do dia.
- Férias, licenças e formação, incompatíveis com turnos já atribuídos.

O perfil é seleccionado no cabeçalho. Administrador opera todos os módulos; Recepcionista opera a recepção; Enfermeiro realiza triagens; Médico realiza consultas, pede e valida exames; Técnico opera laboratório e imagiologia; Enfermeiro e Médico partilham a enfermaria, com admissão e alta reservadas ao Médico; Farmacêutico gere stock e dispensação; Administrativo trata de facturação, caixa e recursos humanos; Direcção consulta em modo de leitura. A sessão demo regressa ao Administrador ao recarregar.

## Percurso de demonstração

1. Em **Pacientes**, criar um paciente fictício.
2. Abrir a ficha e escolher **Marcar consulta**; seleccionar um horário livre para hoje.
3. Na **Agenda de consultas**, confirmar a marcação e registar a **Chegada**.
4. Em **Fila de atendimento**, encontrar o paciente a aguardar triagem.
5. Recarregar a página e verificar a persistência.
6. Consultar **Registo de actividade** para ver as operações.
7. Com o perfil Médico, abrir a consulta e escolher **Pedir exame**.
8. Com o perfil Técnico, em **Laboratório e imagiologia**, registar colheita, processamento e resultado.
9. Voltar ao perfil Médico para validar o resultado e vê-lo no processo clínico e na ficha do paciente.
10. Concluir uma consulta com destino **Internamento** e, em **Enfermarias e camas**, internar o paciente.
11. Registar cuidados, transferir de cama e dar alta; confirmar a cama livre e o internamento na ficha.
12. Com o perfil Farmacêutico, em **Farmácia e armazém**, dar entrada de stock e dispensar uma prescrição pendente.
13. Com o perfil Administrativo, em **Facturação e caixa**, emitir uma factura e registar o pagamento.
14. Em **Colaboradores**, atribuir um turno, registar a presença e consultar as ausências.
15. Em **Configurações**, exportar o JSON ou repor o cenário com confirmação.

Administração, estatística e níveis de gestão constituem a próxima fase. Os módulos restantes têm âmbito e critérios de aceitação no [roteiro](docs/ROADMAP.md), também disponível no ecrã **Roteiro da plataforma**.

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

`src/data/demo.json` contém pacientes, profissionais, unidade, marcações, episódios, enfermarias, camas e um percurso clínico histórico com triagem, consultas concluídas, exames em vários estados, um internamento activo, um armazém com lotes e alertas, facturas, movimentos de caixa e o quadro de pessoal com escalas. Os nomes e contactos são fictícios; os documentos usam prefixos de demonstração. Datas relativas são convertidas no primeiro carregamento, conservando-se até repor os dados.

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
