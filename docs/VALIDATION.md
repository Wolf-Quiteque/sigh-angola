# Verificação — fases 0 e 1

Validado em 8 de Setembro de 2026, Windows, Node.js 22.20.0, Next.js 16.3.4 e Chromium através de Playwright.

## Verificações executadas

| Verificação                     | Resultado                                              |
| ------------------------------- | ------------------------------------------------------ |
| TypeScript estrito              | Sem erros                                              |
| ESLint                          | Sem erros ou avisos de código                          |
| Testes de domínio e repositório | 17 passaram                                            |
| Build de produção               | Concluído; 8 ecrãs funcionais incluindo ficha dinâmica |
| Testes de navegador             | 5 passaram                                             |
| Pedidos externos no painel      | Nenhum pedido externo de API, fonte ou asset           |
| Inspecção visual                | Desktop 1440 px, tablet 768 px e telemóvel 390 px      |

## Percursos verificados

1. Novo paciente → ficha → marcação → confirmação → chegada → fila → recarregar → auditoria. Sem erros JavaScript observados no percurso.
2. BI duplicado: rejeição com mensagem no formulário e conservação dos dados introduzidos. Perfil Direcção: acções de escrita indisponíveis.
3. Reagendamento: data/hora e estado actualizados. Cancelamento com motivo, exportação JSON e reposição confirmada do cenário.
4. Menu móvel, ausência de transbordo horizontal da página, abertura de formulário, foco inicial, Escape, retorno de foco ao botão original e erro recuperável com armazenamento corrompido.
5. Painel de desktop com contadores derivados do JSON e sem pedidos externos.

Testes de regras adicionais: duplicado por nome/data, número único, edição com histórico preservado, datas impossíveis/futuras, telefone inválido, autorização, conflitos por profissional e paciente, limite de 30 minutos, transições inválidas, admissão duplicada, consulta futura e referências do dataset.

Testes do repositório: persistência efectiva, rejeição de revisão obsoleta, falha de quota sem falsa confirmação e preservação de dados corrompidos para recuperação.

## Evidência e execução

`npm.cmd run test:e2e` usa a porta 3100 para não interferir com o serviço existente na porta 3000. Produz `test-results/dashboard-desktop.png`, `test-results/dashboard-tablet.png` e `test-results/patients-mobile.png`. Os contextos de teste são isolados dos dados do navegador do utilizador.

## Limites desta validação

Sem certificação de acessibilidade, ensaio clínico, testes de carga, autenticação real, sincronização, abertura a frio offline, restauro de backups ou validação em hardware hospitalar. Tabelas extensas permitem deslocação horizontal em ecrãs pequenos. Os perfis são simulações e o armazenamento local não protege informação clínica real.

Triagem, consulta e os restantes processos do sistema ainda não foram implementados nem validados; estão explicitamente planeados no roteiro.
