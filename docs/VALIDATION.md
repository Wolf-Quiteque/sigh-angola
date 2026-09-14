# Verificação — fases 0 a 4

Validado em 14 de Setembro de 2026, Windows, Node.js 22.20.0, Next.js 16.3.4 e Chromium através de Playwright.

## Verificações executadas

| Verificação                               | Resultado                                                      |
| ----------------------------------------- | -------------------------------------------------------------- |
| TypeScript estrito                        | Sem erros                                                      |
| ESLint                                    | Sem erros ou avisos                                            |
| Testes de domínio, repositório e migração | 42 passaram                                                    |
| Build de produção                         | Concluído; 12 ecrãs e 2 fichas dinâmicas                       |
| Testes de navegador                       | 11 passaram                                                    |
| Migração dos dados das fases anteriores   | Pacientes, marcações, episódios, clínica e revisão preservados |
| Pedidos externos no painel                | Nenhum pedido externo de API, fonte ou asset                   |
| Inspecção visual                          | Desktop 1440 px, tablet 768 px e telemóvel 390 px              |

## Percursos verificados

1. Novo paciente → ficha → marcação → confirmação → chegada → fila → recarregar → auditoria.
2. Triagem por enfermeiro → sinais vitais → prioridade manual → fila médica ordenada → consulta → diagnóstico → prescrição → alta ambulatória.
3. Reabertura do registo clínico pela ficha longitudinal e persistência depois de recarregar.
4. Consulta finalizada protegida contra edição; adenda separada, com motivo, autoria e data.
5. BI duplicado, conflitos de agenda, admissão duplicada, estados inválidos e perfis sem permissão são rejeitados.
6. Reagendamento, cancelamento justificado, exportação JSON, reposição do cenário e recuperação de armazenamento inválido.
7. Navegação por teclado e responsiva em desktop, tablet e telemóvel.
8. Pedido de exame na consulta → colheita com código de amostra → processamento → resultado → validação médica → resultado definitivo no processo clínico e na ficha do paciente, mantido após recarregar.
9. Imagiologia: pedido → agendamento → realização → relatório → validação; a colheita não é oferecida nesta via.
10. Cancelamento justificado com autoria; o pedido sai das listas pendentes e o motivo fica visível.
11. Consulta com destino «Internamento» → aguardar cama → admissão → registo de cuidados → transferência → alta; a cama de origem fica livre e a de destino ocupada na mesma operação.
12. Internamento visível no processo clínico e na ficha do paciente, com alta, notas e contrarreferência, mantido após recarregar.
13. Bloqueio e manutenção de camas com justificação; camas ocupadas não mudam de estado e ficam fora do denominador da ocupação.

## Regras de fase 4 confirmadas por teste

- Só um episódio encaminhado na consulta pode ser internado; o mesmo paciente não tem dois internamentos activos.
- Camas ocupadas, bloqueadas ou em manutenção não recebem admissões nem transferências.
- A transferência liberta a origem e ocupa o destino na mesma operação e fica registada com motivo e autoria.
- A admissão e a alta são actos médicos; enfermeiros registam cuidados, ocorrências e transferências; a recepção não.
- Depois da alta, o internamento deixa de aceitar registos e a cama volta a ficar livre.
- No cenário inicial, cada cama ocupada corresponde exactamente a um internamento activo.

## Regras de fase 3 confirmadas por teste

- O pedido só nasce numa consulta em curso e guarda paciente, episódio e consulta; pedidos duplicados activos do mesmo exame são recusados.
- Cada via só avança pelos seus estados: processar antes da colheita, relatar antes do processamento ou validar sem resultado são recusados.
- Códigos de amostra são únicos na unidade, independentemente de maiúsculas.
- O técnico opera as duas vias mas não valida; o médico valida mas não executa colheitas; a Direcção não escreve.
- Um resultado validado não pode ser cancelado nem alterado.

A prioridade da triagem é sempre seleccionada pelo profissional. Não existe algoritmo clínico, interpretação de valores ou recomendação automática nesta demo.

## Evidência e execução

`npm.cmd run test:e2e` usa a porta 3100. As capturas ficam em `test-results/`, incluindo o painel, o espaço de consulta e a lista de pedidos de diagnóstico. Os contextos de teste são isolados dos dados do navegador do utilizador.

## Limites desta validação

Sem certificação de acessibilidade, validação clínica, testes de carga, autenticação real, sincronização, abertura a frio offline, restauro de backups ou hardware hospitalar. Os perfis são simulações e o armazenamento local não protege informação clínica real. Os ficheiros de resultado são nomes de exemplo, sem conteúdo anexado; DICOM e PACS ficam para uma integração posterior.

A dispensação de medicamentos ligada à prescrição e os movimentos de stock serão implementados na fase 5.
