import { test, expect } from '@playwright/test';

test('fase 3: pedido em consulta, colheita, resultado, validação e processo clínico', async ({
  page,
}) => {
  await page.goto('/triagem');
  await page.getByLabel('Perfil de demonstração').selectOption('Enfermeiro');
  const triageRow = page.getByRole('row').filter({ hasText: 'Miguel Domingos Chaves' });
  await triageRow.getByRole('button', { name: 'Realizar triagem' }).click();
  const triageDialog = page.getByRole('dialog');
  await triageDialog.getByLabel('Queixa principal').fill('Tosse persistente há uma semana');
  await triageDialog.getByLabel('Prioridade atribuída').selectOption('Amarelo');
  await triageDialog.getByRole('button', { name: 'Concluir triagem' }).click();
  await expect(triageDialog).not.toBeVisible();

  await page.getByRole('link', { name: 'Consultas médicas' }).click();
  await page.getByLabel('Perfil de demonstração').selectOption('Médico');
  await page
    .getByRole('row')
    .filter({ hasText: 'Miguel Domingos Chaves' })
    .getByRole('link', { name: 'Abrir consulta' })
    .click();
  await page.getByRole('button', { name: 'Iniciar consulta' }).click();

  await page.getByRole('button', { name: 'Pedir exame' }).click();
  const requestDialog = page.getByRole('dialog');
  await requestDialog.getByLabel('Via').selectOption('Laboratório');
  await requestDialog.getByLabel('Exame').fill('Hemograma completo');
  await requestDialog.getByLabel('Prioridade').selectOption('Urgente');
  await requestDialog.getByLabel('Informação clínica').fill('Tosse persistente, avaliar anemia.');
  await requestDialog.getByRole('button', { name: 'Registar pedido' }).click();
  await expect(page.getByRole('status')).toContainText('Exame pedido');
  const card = page.locator('.exam-card').filter({ hasText: 'Hemograma completo' });
  await expect(card).toContainText('Pedido');

  await page.getByRole('link', { name: 'Laboratório e imagiologia' }).click();
  await page.getByLabel('Perfil de demonstração').selectOption('Técnico');
  const examRow = page
    .getByRole('row')
    .filter({ hasText: 'Miguel Domingos Chaves' })
    .filter({ hasText: 'Hemograma completo' });
  await examRow.getByRole('button', { name: 'Registar colheita' }).click();
  await page.getByRole('dialog').getByLabel('Código da amostra').fill('AM-000777');
  await page.getByRole('dialog').getByRole('button', { name: 'Registar colheita' }).click();
  await expect(examRow).toContainText('AM-000777');
  await examRow.getByRole('button', { name: 'Iniciar processamento' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Iniciar processamento' }).click();
  await expect(examRow).toContainText('Em processamento');
  await examRow.getByRole('button', { name: 'Lançar resultado' }).click();
  const reportDialog = page.getByRole('dialog');
  await reportDialog.getByLabel('Resultado').fill('Hemoglobina 10,8 g/dL');
  await reportDialog.getByLabel('Descrição e valores').fill('Série branca sem alterações.');
  await reportDialog.getByLabel('Ficheiro de exemplo').fill('hemograma-demo.pdf');
  await reportDialog.getByRole('button', { name: 'Lançar resultado' }).click();
  await expect(examRow).toContainText('Resultado disponível');
  await page.screenshot({ path: 'test-results/diagnostics-board.png', fullPage: true });

  // O técnico não valida: a validação é uma decisão médica.
  await expect(examRow.getByRole('button', { name: 'Validar resultado' })).toBeDisabled();
  await page.getByLabel('Perfil de demonstração').selectOption('Médico');
  await examRow.getByRole('button', { name: 'Validar resultado' }).click();
  await page.getByRole('dialog').getByLabel('Nota de validação').fill('Compatível com o quadro.');
  await page.getByRole('dialog').getByRole('button', { name: 'Validar resultado' }).click();
  await expect(page.getByRole('status')).toContainText('Resultado validado');
  await expect(examRow).toHaveCount(0);

  await page.getByRole('link', { name: 'Consultas médicas' }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'Miguel Domingos Chaves' })
    .getByRole('link', { name: 'Continuar' })
    .click();
  const validated = page.locator('.exam-card').filter({ hasText: 'Hemograma completo' });
  await expect(validated).toContainText('Validado');
  await expect(validated).toContainText('Hemoglobina 10,8 g/dL');
  await page.reload();
  await expect(validated).toContainText('Hemoglobina 10,8 g/dL');
});

test('imagiologia é agendada e realizada antes do relatório', async ({ page }) => {
  await page.goto('/exames');
  await page.getByLabel('Perfil de demonstração').selectOption('Técnico');
  await page.getByRole('tab', { name: 'Imagiologia' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Radiografia de tórax' });
  await expect(row).toContainText('Agendado');
  await expect(row.getByRole('button', { name: 'Registar colheita' })).toHaveCount(0);
  await row.getByRole('button', { name: 'Registar realização' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Registar realização' }).click();
  await expect(row).toContainText('Realizado');
  await row.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const cancelDialog = page.getByRole('dialog');
  await cancelDialog
    .getByLabel('Justificação do cancelamento')
    .fill('Repetido por engano no cenário de demonstração.');
  await cancelDialog.getByRole('button', { name: 'Cancelar pedido' }).click();
  await expect(page.getByRole('status')).toContainText('Pedido de exame cancelado');
  await expect(row).toHaveCount(0);
});
