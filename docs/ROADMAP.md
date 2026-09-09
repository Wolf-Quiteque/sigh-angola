# SIGH-ANGOLA — roteiro de execução

## Âmbito e fontes

Demo funcional em Next.js, em português de Angola, com interface branca e dados inteiramente fictícios em JSON. Sem API, autenticação real ou integrações externas. Fontes: `AdrianoNgandalo.docx` (requisitos de referência, secções 15–44 e RF01–RF20), `Modelo de apresentação.pptx` (visão e contexto) e `index.html` (ilustração, não sistema de design). Os originais são preservados.

O Word é a fonte principal. O PowerPoint contém texto de modelo; esse texto não é requisito. A triagem simplificada do HTML não constitui um protocolo clínico validado e não será reutilizada como algoritmo de decisão.

## Forma de trabalhar

Entregar uma fase utilizável de cada vez. Em cada fase: definir entidades e estados → implementar regras no domínio → construir interface → testar operações, erros, persistência e permissões → rever visualmente → actualizar este roteiro. Uma fase não equivale a um conjunto de ecrãs estáticos. Nenhum botão deve anunciar sucesso sem alterar os dados correspondentes.

## Fase 0 — planeamento e arquitectura

Estado: executada.

- Inventário e leitura das três fontes; requisitos extraídos em `source-requirements.txt`.
- Next.js App Router + TypeScript; componentes partilhados; tokens CSS; idioma `pt-AO`, moeda AOA e fuso Africa/Luanda.
- Separar interface, domínio e repositório. JSON inicial reproduzível, persistência local versionada e operações auditadas.
- Distinguir paciente, marcação e episódio; identificadores estáveis e referências por ID.

## Fase 1 — fundação, recepção e agenda

Estado: implementada; consultar `VALIDATION.md` para evidência de verificações.

Inclui painel operacional derivado dos dados, pesquisa e filtro de pacientes, registo e edição com validação, prevenção de BI duplicado e de nome/data de nascimento repetidos, ficha demográfica e histórico de episódios, marcação, confirmação, reagendamento, cancelamento, chegada e admissão directa. Agenda impede sobreposição por profissional e por paciente em intervalos de 30 minutos. Admissão impede episódios activos duplicados. Fila termina em «Aguarda triagem»; a classificação clínica pertence à fase seguinte.

Sessões de demonstração (administrador, recepcionista e direcção), permissões no domínio, auditoria, exportação JSON, reinício explícito do cenário e recuperação de armazenamento inválido. A persistência local não é uma implementação de sincronização ou de segurança clínica.

Aceitação: criar paciente → marcar → confirmar → registar chegada → consultar episódio na fila e na ficha → recarregar → confirmar persistência → localizar auditoria; rejeitar duplicados, conflitos de agenda e alterações por perfil de leitura.

Cobertura: RF03, RF04, RF06 (agenda), RF16 (recepção), RF19 (mutações locais); fundação parcial de RF01/RF02. Cartão/QR, acesso auditado e gestão completa de utilizadores ficam na fase 7.

## Fase 2 — triagem, consulta e processo clínico

Estado: implementada; consultar `VALIDATION.md` para evidência. RF05, RF06 clínico, RF07, RF08.

- Triagem: queixa, sinais vitais completos, observações, prioridade atribuída por profissional; regras clínicas a validar com equipa clínica.
- Consulta: chamar/iniciar/concluir, antecedentes, alergias, diagnóstico, procedimentos, evolução, destino e alta ambulatória.
- Prescrição estruturada: medicamento, dose, via, frequência, duração, observações e prescritor; ligação ao episódio e paciente.
- Processo clínico longitudinal; correções rastreáveis, sem apagar notas finalizadas.
- Aceitação: admissão → triagem manual → fila por prioridade → consulta → prescrição → conclusão → processo longitudinal; referências consistentes, migração da fase 1, permissões por perfil e adendas sem alterar o registo finalizado.

A classificação de prioridade é sempre atribuída pelo profissional. A demo não calcula, recomenda ou valida protocolos clínicos. Destinos de internamento e transferência ficam pendentes até à fase 4.

## Fase 3 — laboratório e imagiologia

Estado: próxima fase. RF11, RF12.

- Pedido → colheita → processamento → resultado → validação → processo clínico.
- Imagiologia: pedido → agenda → realização → relatório → validação.
- Cancelamento justificado, autoria, resultados pendentes e exemplos de ficheiros locais. DICOM/PACS é integração futura.
- Aceitação: apenas resultados validados entram no processo como finais; pedidos nunca perdem a ligação à consulta.

## Fase 4 — internamento e enfermagem

Estado: por iniciar. RF09, RF10.

- Enfermarias, camas livres/ocupadas/bloqueadas/em manutenção; admissão, transferência e alta.
- Médico responsável, evolução, procedimentos e administração de medicamentos; referências e contrarreferências.
- Registos demonstrativos de partos, cirurgias e óbitos para estatística.
- Aceitação: impossível atribuir uma cama ocupada ou admitir duas vezes; transferência liberta a origem e ocupa o destino na mesma operação; alta actualiza histórico e indicadores.

## Fase 5 — farmácia e armazém

Estado: por iniciar. RF13, RF14.

- Medicamentos, materiais, consumíveis, equipamentos, fornecedores, lotes, validades e limites de stock.
- Entrada, saída, inventário, ajuste justificado, requisição e transferência.
- Dispensação ligada à prescrição, parcial/total, com movimentos rastreáveis e alertas de validade/stock.
- Aceitação: impedir stock negativo, lote expirado e dispensação superior ao restante; consumo alimenta indicadores.

## Fase 6 — finanças e recursos humanos

Estado: por iniciar. Secções 28–29.

- Tabelas de serviços, facturação demo, pagamentos parciais, recibos de demonstração, caixa, despesas, receitas, contas e convénios/seguros; valores em kwanzas.
- Colaboradores, funções, departamentos, escalas, presenças, férias, formação e unidade.
- Aceitação: saldo reconciliado com movimentos; pagamentos duplicados rejeitados; sobreposição de escalas e ausências controlada. Documentos fiscais reais ficam fora da demo.

## Fase 7 — administração, estatística e níveis de gestão

Estado: por iniciar. RF01, RF02, RF15, RF16, RF19, RF20.

- Gestão de utilizadores e todos os perfis do documento, matriz de permissões, sessão simulada, inactivação e simulação de recuperação de acesso.
- Cartão de paciente imprimível e QR contendo somente identificador; responsáveis e identificação de emergência.
- Indicadores reais dos datasets: consultas, especialidades, urgências, internamentos, ocupação, permanência, altas, mortalidade, partos, cirurgias, exames, consumo e referências; explicitar denominadores e intervalos.
- Filtros e agregação unidade → município → província → nacional; relatórios exportáveis, qualidade de dados e auditoria de acesso.
- Aceitação: totais reconciliados com os registos e filtros; perfis agregados sem exposição de processos individuais.

## Fase 8 — offline, sincronização simulada e recuperação

Estado: por iniciar. RF17, RF18; RNF06, RNF07, secções 43–44.

- Migrar adaptador local para IndexedDB; cache da aplicação para abertura/reabertura sem rede; tablets.
- Outbox com UUID, revisão, utilizador, dispositivo e timestamp; servidor apenas simulado em armazenamento local separado.
- Estados pendente/em envio/confirmado/erro/conflito; tentativas idempotentes, interrupções e resolução manual de conflitos.
- Backup JSON validado, restauro, migrações de esquema e recuperação sem apagar dados não confirmados.
- Aceitação: carregar offline após instalação, registar, recarregar, simular reconexão, interromper e repetir sem duplicar; conflito visível e recuperável.

## Fase 9 — validação integral da demo

Estado: por iniciar. RNF01–RNF10 no âmbito demonstrativo.

- Cenários completos ambulatório, internamento, exame, farmácia e caixa; testes negativos e isolamento entre unidades.
- Acessibilidade por teclado, foco, contraste, erros, estados vazios, carregamento, impressão e tablets.
- Datasets variados e reproduzíveis; revisão com recepção, enfermagem, médicos e gestão.
- Aceitação: todos os percursos anteriores passam, não existem acções falsas e limitações estão documentadas.

## Após a demo — projecto separado

API, base central, autenticação e autorização de servidor, encriptação, auditoria resistente a alteração, backups operacionais, conformidade, protocolos clínicos validados, integrações MINSA/dispositivos/FHIR/DICOM, implantação e suporte. O repositório é a fronteira de substituição, não uma promessa de que localStorage serve para produção.
