# Verificação — fases 0 a 2

Validado em 9 de Setembro de 2026, Windows, Node.js 22.20.0, Next.js 16.3.4 e Chromium através de Playwright.

## Verificações executadas

| Verificação                               | Resultado                                             |
| ----------------------------------------- | ----------------------------------------------------- |
| TypeScript estrito                        | Sem erros                                             |
| ESLint                                    | Sem erros ou avisos                                   |
| Testes de domínio, repositório e migração | 24 passaram                                           |
| Build de produção                         | Concluído; 10 ecrãs e 2 fichas dinâmicas              |
| Testes de navegador                       | 7 passaram                                            |
| Migração dos dados da fase 1              | Pacientes, marcações, episódios e revisão preservados |
| Pedidos externos no painel                | Nenhum pedido externo de API, fonte ou asset          |
| Inspecção visual                          | Desktop 1440 px, tablet 768 px e telemóvel 390 px     |

## Percursos verificados

1. Novo paciente → ficha → marcação → confirmação → chegada → fila → recarregar → auditoria.
2. Triagem por enfermeiro → sinais vitais → prioridade manual → fila médica ordenada → consulta → diagnóstico → prescrição → alta ambulatória.
3. Reabertura do registo clínico pela ficha longitudinal e persistência depois de recarregar.
4. Consulta finalizada protegida contra edição; adenda separada, com motivo, autoria e data.
5. BI duplicado, conflitos de agenda, admissão duplicada, estados inválidos e perfis sem permissão são rejeitados.
6. Reagendamento, cancelamento justificado, exportação JSON, reposição do cenário e recuperação de armazenamento inválido.
7. Navegação por teclado e responsiva em desktop, tablet e telemóvel.

A prioridade da triagem é sempre seleccionada pelo profissional. Não existe algoritmo clínico ou recomendação automática nesta demo.

## Evidência e execução

`npm.cmd run test:e2e` usa a porta 3100. As capturas ficam em `test-results/`, incluindo o painel e o espaço de consulta. Os contextos de teste são isolados dos dados do navegador do utilizador.

## Limites desta validação

Sem certificação de acessibilidade, validação clínica, testes de carga, autenticação real, sincronização, abertura a frio offline, restauro de backups ou hardware hospitalar. Os perfis são simulações e o armazenamento local não protege informação clínica real.

Os destinos «Internamento» e «Transferência» são registados como decisão clínica; a criação efectiva do internamento ou transferência será implementada na fase 4. Pedidos de laboratório e imagiologia constituem a fase 3.
