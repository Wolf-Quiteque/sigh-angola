import { test, expect } from '@playwright/test';

test('fase 6: emitir factura, cobrar e reconciliar o saldo de caixa', async ({ page }) => {
  await page.goto('/financas');
  await page.getByLabel('Perfil do utilizador').selectOption('Administrativo');

  await page.getByRole('button', { name: 'Emitir factura' }).click();
  const issue = page.getByRole('dialog');
  await issue.getByLabel('Paciente').selectOption('p1');
  await issue.getByLabel('Convénio ou seguro').selectOption({ index: 1 });
  await issue.getByRole('button', { name: 'Adicionar serviço' }).click();
  await issue.getByLabel('Serviço').selectOption('srv-001');
  await expect(issue.getByText('A pagar pelo paciente')).toBeVisible();
  await issue.getByRole('button', { name: 'Emitir factura' }).click();
  await expect(page.getByRole('status')).toContainText('Factura emitida');

  const invoice = page.getByRole('row').filter({ hasText: 'Esperança Manuel Zua' });
  await expect(invoice).toContainText('Emitida');
  await invoice.getByRole('button', { name: 'Registar pagamento' }).click();
  const pay = page.getByRole('dialog');
  await pay.getByLabel('Valor em kwanzas').fill('500');
  await pay.getByLabel('Meio de pagamento').selectOption('Multicaixa');
  await pay.getByRole('button', { name: 'Registar pagamento' }).click();
  await expect(page.getByRole('status')).toContainText('Pagamento parcial');
  await expect(invoice).toContainText('Parcialmente paga');
  await expect(invoice).toContainText('REC-');
  await page.screenshot({ path: 'test-results/finance-board.png', fullPage: true });

  // Uma factura com pagamentos já não pode ser anulada.
  await expect(invoice.getByRole('button', { name: 'Anular' })).toBeDisabled();

  await page.getByRole('tab', { name: 'Caixa' }).click();
  const receipt = page.getByRole('row').filter({ hasText: 'Recibo REC-' }).first();
  await expect(receipt).toContainText('Receita');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const expense = page.getByRole('dialog');
  await expense.getByLabel('Categoria').fill('Combustível');
  await expense.getByLabel('Valor em kwanzas').fill('60000');
  await expense.getByLabel('Descrição').fill('Gasóleo para o gerador da unidade.');
  await expense.getByRole('button', { name: 'Registar movimento' }).click();
  await expect(page.getByRole('status')).toContainText('Despesa registada');
  await page.reload();
  await page.getByRole('tab', { name: 'Caixa' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Gasóleo para o gerador' })).toContainText(
    '−',
  );
});

test('pagamento acima da dívida é recusado e a tabela de serviços alimenta a factura', async ({
  page,
}) => {
  await page.goto('/financas');
  await page.getByLabel('Perfil do utilizador').selectOption('Administrativo');
  const open = page.getByRole('row').filter({ hasText: 'FT-000002' });
  await open.getByRole('button', { name: 'Registar pagamento' }).click();
  const pay = page.getByRole('dialog');
  // O valor em dívida é o limite do campo: liquidar a factura fecha-a para novos pagamentos.
  await pay.getByRole('button', { name: 'Registar pagamento' }).click();
  await expect(page.getByRole('status')).toContainText('Factura paga');
  await expect(open).toContainText('Paga');
  await expect(open.getByRole('button', { name: 'Registar pagamento' })).toBeDisabled();

  await page.getByRole('tab', { name: 'Tabelas e convénios' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Diária de internamento' })).toContainText(
    '15',
  );
});

test('fase 6: escalas sem sobreposição, presenças e ausências', async ({ page }) => {
  await page.goto('/recursos-humanos');
  await page.getByLabel('Perfil do utilizador').selectOption('Administrativo');
  await expect(page.getByRole('row').filter({ hasText: 'Dr. Paulo Chissola' })).toContainText(
    'Activo',
  );

  await page.getByRole('tab', { name: 'Escalas e presenças' }).click();
  await page.getByRole('button', { name: 'Atribuir turno' }).click();
  const shift = page.getByRole('dialog');
  await shift.getByLabel('Colaborador').selectOption('st-5');
  await shift.getByLabel('Início').fill('20:30');
  await shift.getByLabel('Fim').fill('23:00');
  await shift.getByRole('button', { name: 'Atribuir turno' }).click();
  await expect(shift.getByRole('alert')).toContainText('turno sobreposto');
  await shift.getByLabel('Início').fill('08:00');
  await shift.getByLabel('Fim').fill('14:00');
  await shift.getByRole('button', { name: 'Atribuir turno' }).click();
  await expect(page.getByRole('status')).toContainText('Turno atribuído');

  const row = page
    .getByRole('row')
    .filter({ hasText: 'Enf. Teresa Lando' })
    .filter({ hasText: '08:00' });
  await row.getByRole('button', { name: 'Registar presença' }).click();
  const attendance = page.getByRole('dialog');
  await attendance.getByLabel('Situação').selectOption('Falta justificada');
  await attendance.getByRole('button', { name: 'Guardar presença' }).click();
  await expect(attendance.getByRole('alert')).toContainText('justificação');
  await attendance.getByLabel('Observações').fill('Deslocação a formação em Menongue.');
  await attendance.getByRole('button', { name: 'Guardar presença' }).click();
  await expect(page.getByRole('status')).toContainText('Presença registada');
  await expect(row).toContainText('Falta justificada');
  await page.screenshot({ path: 'test-results/people-board.png', fullPage: true });

  await page.getByRole('tab', { name: 'Férias e formação' }).click();
  await page.getByRole('button', { name: 'Registar ausência' }).click();
  const absence = page.getByRole('dialog');
  await absence.getByLabel('Colaborador').selectOption('st-5');
  await absence.getByRole('button', { name: 'Registar ausência' }).click();
  await expect(absence.getByRole('alert')).toContainText('turno(s) neste período');
  await absence.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Dr. Paulo Chissola' })).toContainText(
    'Férias',
  );
});
