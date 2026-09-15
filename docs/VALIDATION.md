# Verificação — fases 0 a 7

Validado em 14 de Setembro de 2026, Windows, Node.js 22.20.0, Next.js 16.3.4 e Chromium através de Playwright.

## Verificações executadas

| Verificação                               | Resultado                                                      |
| ----------------------------------------- | -------------------------------------------------------------- |
| TypeScript estrito                        | Sem erros                                                      |
| ESLint                                    | Sem erros ou avisos                                            |
| Testes de domínio, repositório e migração | 78 passaram                                                    |
| Build de produção                         | Concluído; 17 ecrãs e 2 fichas dinâmicas                       |
| Testes de navegador                       | 20 passaram                                                    |
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
14. Entrada de stock com lote e fornecedor → requisição para um serviço → ajuste de inventário justificado → dispensação parcial ligada à prescrição, com saldo visível no livro de movimentos e mantida após recarregar.
15. Alertas de stock mínimo, de validade próxima e de lote expirado; saída acima do disponível e dispensação de lote expirado são recusadas.
16. Emissão de factura a partir da tabela de serviços com comparticipação de convénio → pagamento parcial com recibo → movimento de caixa correspondente → despesa registada, tudo mantido após recarregar.
17. Atribuição de turno com recusa de sobreposição → presença registada com justificação obrigatória → ausência recusada por existirem turnos no período.
18. Indicadores recalculados ao mudar o intervalo; ocupação reconciliada com o mapa de camas; agregação por unidade, município, província e nacional com totais e sem processos de outras unidades.
19. Criação de utilizador com nome de utilizador único, matriz de permissões lida do domínio e recuperação de acesso simulada.
20. Cartão do paciente com QR do identificador, impressão preparada e registo do acesso à ficha na auditoria de acesso.

## Regras de fase 7 confirmadas por teste

- Cada indicador conta apenas ocorrências no intervalo pedido e declara o denominador que usa.
- A taxa de ocupação coincide com o mapa de camas e exclui bloqueadas e em manutenção.
- Altas, óbitos, mortalidade, referências e contrarreferências saem dos internamentos registados; o consumo sai das dispensações.
- As consultas por especialidade somam exactamente o total de consultas do intervalo.
- Nomes de utilizador são únicos, em minúsculas, e a unidade nunca fica sem administrador activo.
- Só o administrador cria, edita ou recupera utilizadores; um utilizador inactivo não recupera o acesso.
- O registo de acesso funciona em qualquer perfil, incluindo Direcção, não altera dados nem entra na auditoria de alterações, e não duplica o mesmo acesso dentro de um minuto.
- O QR do cartão contém apenas o número do paciente.

## Regras de fase 6 confirmadas por teste

- A factura calcula-se da tabela de serviços; a comparticipação é arredondada a favor do paciente.
- Nenhum pagamento excede o valor em dívida; uma factura paga ou anulada não recebe mais pagamentos.
- Um pagamento igual ao anterior em valor e meio, há menos de dois minutos, é recusado.
- Uma factura com pagamentos não pode ser anulada; a anulação exige motivo.
- O saldo de caixa é sempre a soma dos movimentos, incluindo os recibos gerados pelos pagamentos.
- Turnos do mesmo colaborador não se sobrepõem, não caem em datas passadas nem em períodos de ausência.
- As presenças só existem em dias com turno, não são futuras e uma falta justificada exige justificação.
- Ausências não se sobrepõem entre si nem cobrem turnos já atribuídos; um colaborador com turnos por cumprir não é inactivado.

## Regras de fase 5 confirmadas por teste

- Nenhuma saída, requisição ou dispensação deixa o stock negativo; a entrada acima do stock máximo é recusada.
- Lotes expirados não podem receber entradas nem ser dispensados.
- A dispensação nunca excede o que falta da prescrição; parcial e total ficam distinguidas na auditoria.
- Saídas, requisições e ajustes exigem justificação; o ajuste guarda a diferença entre o registado e a contagem.
- A quantidade já dispensada é preservada quando a consulta é reeditada e impede a remoção do medicamento.
- Só o perfil Farmacêutico (ou Administrador) movimenta stock; códigos de artigo são únicos.

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

As facturas e recibos são documentos de demonstração, sem valor fiscal, e o módulo não implementa contabilidade nem processamento salarial. Os indicadores são calculados sobre dados fictícios e não substituem informação estatística oficial. A demonstração não tem autenticação, palavras-passe nem sessões reais: o perfil continua a ser escolhido no cabeçalho. O funcionamento sem rede, a sincronização simulada e o restauro de cópias serão implementados na fase 8.
