import { test, expect, type Page } from '@playwright/test';

/**
 * Fase 9 — o percurso completo da demonstração num único teste.
 * Do registo do paciente à alta, à dispensação, à cobrança e ao indicador
 * que conta o que aconteceu. Cada passo verifica dados, não apenas ecrãs.
 */
const profile = (page: Page, role: string) =>
  page.getByLabel('Perfil do utilizador').selectOption(role);

test('percurso integral: recepção, clínica, exame, internamento, farmácia, caixa e indicadores', async ({
  page,
}) => {
  test.slow();
  const name = 'Joana Valentina Sengo';

  // 1. Recepção: registo do paciente.
  await page.goto('/pacientes');
  await profile(page, 'Recepcionista');
  await page.getByRole('button', { name: 'Novo paciente' }).click();
  const patientForm = page.getByRole('dialog');
  await patientForm.getByLabel('Nome completo').fill(name);
  await patientForm.getByLabel('Data de nascimento').fill('1992-08-14');
  await patientForm.getByLabel('Sexo').selectOption('Feminino');
  await patientForm.getByLabel('Bilhete de identidade').fill('DEMO900001');
  await patientForm.getByLabel('Telefone').fill('923000900');
  await patientForm.getByLabel('Município').fill('Menongue');
  await patientForm.getByLabel('Contacto de emergência').fill('Valentina Sengo · 923000901');
  await patientForm.getByRole('button', { name: 'Registar paciente' }).click();
  await expect(page.getByRole('status')).toContainText('Paciente registado');

  // 2. Admissão directa a partir da ficha.
  await page.getByPlaceholder('Pesquisar por nome').fill(name);
  await page
    .getByRole('link', { name: new RegExp(name) })
    .first()
    .click();
  await page.getByRole('button', { name: 'Admissão directa' }).click();
  const admissionForm = page.getByRole('dialog');
  await admissionForm.getByLabel('Motivo').fill('Dor abdominal com febre há dois dias');
  await admissionForm.getByRole('button', { name: 'Registar admissão' }).click();
  await expect(page.getByRole('status')).toContainText('Chegada registada');

  // 3. Triagem pelo enfermeiro.
  await page.goto('/triagem');
  await profile(page, 'Enfermeiro');
  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Realizar triagem' })
    .click();
  const triageForm = page.getByRole('dialog');
  await triageForm.getByLabel('Prioridade atribuída').selectOption('Laranja');
  await triageForm.getByLabel('Temperatura').fill('38.7');
  await triageForm.getByRole('button', { name: 'Concluir triagem' }).click();
  await expect(triageForm).not.toBeVisible();

  // 4. Consulta, prescrição com quantidade e pedido de exame.
  await page.goto('/consultas');
  await profile(page, 'Médico');
  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('link', { name: 'Abrir consulta' })
    .click();
  await page.getByRole('button', { name: 'Iniciar consulta' }).click();
  await page.getByLabel('Diagnóstico').fill('Síndrome febril a esclarecer');
  await page.getByLabel('Evolução / plano').fill('Pedir análises e internar para vigilância.');
  await page.getByRole('button', { name: 'Adicionar medicamento' }).click();
  await page.getByLabel('Medicamento').fill('Paracetamol');
  await page.getByLabel('Dose').fill('500 mg');
  await page.getByLabel('Frequência').fill('8/8 horas');
  await page.getByLabel('Duração').fill('3 dias');
  await page.getByLabel('Quantidade').fill('9');
  await page.getByRole('button', { name: 'Guardar rascunho' }).click();
  await expect(page.getByRole('status')).toContainText('Consulta guardada');

  await page.getByRole('button', { name: 'Pedir exame' }).click();
  const examForm = page.getByRole('dialog');
  await examForm.getByLabel('Exame').fill('Teste rápido de malária');
  await examForm.getByLabel('Prioridade').selectOption('Urgente');
  await examForm.getByRole('button', { name: 'Registar pedido' }).click();
  await expect(page.getByRole('status')).toContainText('Exame pedido');

  // 5. Laboratório: colheita, processamento, resultado.
  await page.goto('/exames');
  await profile(page, 'Técnico');
  const examRow = page
    .getByRole('row')
    .filter({ hasText: name })
    .filter({ hasText: 'Teste rápido de malária' });
  await examRow.getByRole('button', { name: 'Registar colheita' }).click();
  await page.getByRole('dialog').getByLabel('Código da amostra').fill('AM-900001');
  await page.getByRole('dialog').getByRole('button', { name: 'Registar colheita' }).click();
  await examRow.getByRole('button', { name: 'Iniciar processamento' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Iniciar processamento' }).click();
  await examRow.getByRole('button', { name: 'Lançar resultado' }).click();
  await page.getByRole('dialog').getByLabel('Resultado').fill('Negativo para Plasmodium');
  await page.getByRole('dialog').getByRole('button', { name: 'Lançar resultado' }).click();
  await expect(examRow).toContainText('Resultado disponível');

  // 6. O médico valida o resultado e encaminha para internamento.
  await profile(page, 'Médico');
  await examRow.getByRole('button', { name: 'Validar resultado' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Validar resultado' }).click();
  await expect(page.getByRole('status')).toContainText('Resultado validado');

  await page.goto('/consultas');
  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('link', { name: 'Continuar' })
    .click();
  await expect(page.locator('.exam-card').filter({ hasText: 'Teste rápido' })).toContainText(
    'Negativo para Plasmodium',
  );
  await page.getByLabel('Destino após consulta').selectOption('Internamento');
  await page.getByRole('button', { name: 'Concluir consulta' }).click();

  // 7. Internamento, cuidados e alta.
  await page.goto('/internamento');
  await page
    .getByRole('row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Internar' })
    .click();
  const admitForm = page.getByRole('dialog');
  await admitForm.getByLabel('Cama').selectOption({ index: 0 });
  await admitForm.getByRole('button', { name: 'Internar' }).click();
  await expect(page.getByRole('status')).toContainText('Internamento aberto');

  await profile(page, 'Enfermeiro');
  const stayRow = page.getByRole('row').filter({ hasText: name }).filter({ hasText: 'dia(s)' });
  await stayRow.getByRole('button', { name: 'Registar cuidados' }).click();
  const careForm = page.getByRole('dialog');
  await careForm
    .getByLabel('Registo *', { exact: false })
    .last()
    .fill('Hidratação endovenosa em curso.');
  await careForm.getByRole('button', { name: 'Registar cuidados' }).click();
  await expect(page.getByRole('status')).toContainText('Registo de enfermaria');

  await profile(page, 'Médico');
  await stayRow.getByRole('button', { name: 'Dar alta' }).click();
  const dischargeForm = page.getByRole('dialog');
  await dischargeForm.getByLabel('Tipo de alta').selectOption('Alta clínica');
  await dischargeForm
    .getByLabel('Nota de alta / contrarreferência')
    .fill('Apirética, com orientação para reavaliação.');
  await dischargeForm.getByRole('button', { name: 'Dar alta' }).click();
  await expect(page.getByRole('status')).toContainText('Alta de internamento');

  // 8. Farmácia: dispensação ligada à prescrição.
  await page.goto('/farmacia');
  await profile(page, 'Farmacêutico');
  await page.getByRole('tab', { name: 'Dispensação' }).click();
  const prescriptionRow = page
    .getByRole('row')
    .filter({ hasText: name })
    .filter({ hasText: 'Paracetamol' });
  await prescriptionRow.getByRole('button', { name: 'Dispensar' }).click();
  const dispenseForm = page.getByRole('dialog');
  await dispenseForm.getByLabel('Lote a debitar').selectOption('b-par-1');
  await dispenseForm.getByRole('button', { name: 'Registar dispensação' }).click();
  await expect(page.getByRole('status')).toContainText('Dispensação total');

  // 9. Facturação e cobrança.
  await page.goto('/financas');
  await profile(page, 'Administrativo');
  await page.getByRole('button', { name: 'Emitir factura' }).click();
  const invoiceForm = page.getByRole('dialog');
  const patientOption = await invoiceForm
    .locator('select[name="patientId"] option')
    .filter({ hasText: name })
    .getAttribute('value');
  await invoiceForm.getByLabel('Paciente').selectOption(patientOption!);
  await invoiceForm.getByRole('button', { name: 'Adicionar serviço' }).click();
  await invoiceForm.getByLabel('Serviço').selectOption('srv-001');
  await invoiceForm.getByRole('button', { name: 'Emitir factura' }).click();
  await expect(page.getByRole('status')).toContainText('Factura emitida');
  const invoiceRow = page.getByRole('row').filter({ hasText: name });
  await invoiceRow.getByRole('button', { name: 'Registar pagamento' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Registar pagamento' }).click();
  await expect(page.getByRole('status')).toContainText('Factura paga');
  await expect(invoiceRow).toContainText('Paga');

  // 10. Os indicadores contam o que aconteceu.
  await page.goto('/indicadores');
  await expect(page.locator('.indicator-card').filter({ hasText: 'Altas' }).first()).toContainText(
    '1',
  );
  // Um validado no cenário inicial mais o deste percurso.
  await expect(
    page.locator('.indicator-card').filter({ hasText: 'Exames validados' }),
  ).toContainText('2');
  await expect(
    page.locator('.indicator-card').filter({ hasText: 'Unidades dispensadas' }),
  ).toContainText('9');

  // 11. A ficha do paciente reúne todo o percurso.
  await page.goto('/pacientes');
  await page.getByPlaceholder('Pesquisar por nome').fill(name);
  await page
    .getByRole('link', { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.locator('.exam-card').filter({ hasText: 'Teste rápido' })).toContainText(
    'Validado',
  );
  await expect(page.locator('.exam-card').filter({ hasText: 'Enfermaria' })).toContainText(
    'Alta clínica',
  );
  await page.screenshot({ path: 'test-results/percurso-ficha.png', fullPage: true });

  // 12. Tudo o que foi feito está na fila de envio e no registo de actividade.
  await page.goto('/sincronizacao');
  const queue = page.locator('.panel').filter({ hasText: 'Fila de envio' });
  await expect(queue.getByRole('row').filter({ hasText: 'Alta de internamento' })).toContainText(
    'Pendente',
  );
  await page.goto('/auditoria');
  await page.getByPlaceholder('Pesquisar operação').fill(name);
  await expect(page.getByRole('row').filter({ hasText: 'Paciente registado' })).toBeVisible();
});
