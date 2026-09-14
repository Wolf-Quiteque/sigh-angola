import { test, expect } from '@playwright/test';

test('fase 4: consulta encaminha, internamento ocupa cama, transferência e alta libertam-na', async ({
  page,
}) => {
  await page.goto('/triagem');
  await page.getByLabel('Perfil de demonstração').selectOption('Enfermeiro');
  const triageRow = page.getByRole('row').filter({ hasText: 'Esperança Manuel Zua' });
  await triageRow.getByRole('button', { name: 'Realizar triagem' }).click();
  const triageDialog = page.getByRole('dialog');
  await triageDialog.getByLabel('Queixa principal').fill('Dor abdominal intensa há um dia');
  await triageDialog.getByLabel('Prioridade atribuída').selectOption('Laranja');
  await triageDialog.getByRole('button', { name: 'Concluir triagem' }).click();
  await expect(triageDialog).not.toBeVisible();

  await page.getByRole('link', { name: 'Consultas médicas' }).click();
  await page.getByLabel('Perfil de demonstração').selectOption('Médico');
  await page
    .getByRole('row')
    .filter({ hasText: 'Esperança Manuel Zua' })
    .getByRole('link', { name: 'Abrir consulta' })
    .click();
  await page.getByRole('button', { name: 'Iniciar consulta' }).click();
  await page.getByLabel('Diagnóstico').fill('Abdómen agudo em estudo');
  await page.getByLabel('Evolução / plano').fill('Internar para vigilância e analgesia.');
  await page.getByRole('button', { name: 'Guardar rascunho' }).click();
  await expect(page.getByRole('status')).toContainText('Consulta guardada');
  await page.getByLabel('Destino após consulta').selectOption('Internamento');
  await page.getByRole('button', { name: 'Concluir consulta' }).click();

  await page.getByRole('link', { name: 'Enfermarias e camas' }).click();
  const waitingRow = page.getByRole('row').filter({ hasText: 'Esperança Manuel Zua' });
  await waitingRow.getByRole('button', { name: 'Internar' }).click();
  const admitDialog = page.getByRole('dialog');
  await admitDialog.getByLabel('Cama').selectOption({ label: 'Enfermaria de Medicina · MI-01' });
  await admitDialog.getByLabel('Motivo do internamento').fill('Vigilância e analgesia endovenosa');
  await admitDialog.getByRole('button', { name: 'Internar' }).click();
  await expect(page.getByRole('status')).toContainText('Internamento aberto');
  const bedChip = page.getByRole('button', { name: /Cama MI-01/ });
  await expect(bedChip).toContainText('Esperança Manuel Zua');
  await expect(bedChip).toBeDisabled();
  await page.screenshot({ path: 'test-results/ward-board.png', fullPage: true });

  const stayRow = page
    .getByRole('row')
    .filter({ hasText: 'Esperança Manuel Zua' })
    .filter({ hasText: 'MI-01' });
  await page.getByLabel('Perfil de demonstração').selectOption('Enfermeiro');
  await stayRow.getByRole('button', { name: 'Registar cuidados' }).click();
  const noteDialog = page.getByRole('dialog');
  await noteDialog.getByLabel('Tipo de registo').selectOption('Administração de medicamento');
  await noteDialog
    .getByLabel('Registo', { exact: false })
    .last()
    .fill('Analgésico administrado às 10:00.');
  await noteDialog.getByRole('button', { name: 'Registar cuidados' }).click();
  await expect(page.getByRole('status')).toContainText('Registo de enfermaria');

  await stayRow.getByRole('button', { name: 'Transferir de cama' }).click();
  const transferDialog = page.getByRole('dialog');
  await transferDialog
    .getByLabel('Cama de destino')
    .selectOption({ label: 'Enfermaria de Medicina · MI-02' });
  await transferDialog
    .getByLabel('Motivo da transferência')
    .fill('Aproximar do posto de enfermagem.');
  await transferDialog.getByRole('button', { name: 'Transferir de cama' }).click();
  await expect(page.getByRole('status')).toContainText('Transferência de cama');
  await expect(page.getByRole('button', { name: /Cama MI-01/ })).toContainText('Livre');
  await expect(page.getByRole('button', { name: /Cama MI-02/ })).toContainText(
    'Esperança Manuel Zua',
  );

  // A alta é um acto médico: o enfermeiro não a pode executar.
  const movedRow = page
    .getByRole('row')
    .filter({ hasText: 'Esperança Manuel Zua' })
    .filter({ hasText: 'MI-02' });
  await expect(movedRow.getByRole('button', { name: 'Dar alta' })).toBeDisabled();
  await page.getByLabel('Perfil de demonstração').selectOption('Médico');
  await movedRow.getByRole('button', { name: 'Dar alta' }).click();
  const dischargeDialog = page.getByRole('dialog');
  await dischargeDialog.getByLabel('Tipo de alta').selectOption('Alta clínica');
  await dischargeDialog
    .getByLabel('Nota de alta / contrarreferência')
    .fill('Melhoria clínica, reavaliação em sete dias.');
  await dischargeDialog.getByRole('button', { name: 'Dar alta' }).click();
  await expect(page.getByRole('status')).toContainText('Alta de internamento');
  await expect(page.getByRole('button', { name: /Cama MI-02/ })).toContainText('Livre');

  await page.getByRole('link', { name: 'Pacientes', exact: true }).click();
  await page.getByPlaceholder('Pesquisar por nome').fill('Esperança Manuel Zua');
  await page
    .getByRole('link', { name: /Esperança Manuel Zua/ })
    .first()
    .click();
  const history = page.locator('.exam-card').filter({ hasText: 'MI-02' });
  await expect(history).toContainText('Alta clínica');
  await expect(history).toContainText('Melhoria clínica, reavaliação em sete dias.');
  await page.reload();
  await expect(history).toContainText('Alta clínica');
});

test('camas bloqueadas e em manutenção ficam fora da ocupação', async ({ page }) => {
  await page.goto('/internamento');
  await page.getByLabel('Perfil de demonstração').selectOption('Enfermeiro');
  await expect(page.getByRole('button', { name: /Cama MI-07/ })).toContainText('Bloqueada');
  await expect(page.getByRole('button', { name: /Cama PED-05/ })).toContainText('Em manutenção');
  await page.getByRole('button', { name: /Cama MI-04/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Novo estado').selectOption('Em manutenção');
  await dialog.getByRole('button', { name: 'Actualizar cama' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Explique');
  await dialog.getByLabel('Motivo').fill('Aguarda substituição do colchão.');
  await dialog.getByRole('button', { name: 'Actualizar cama' }).click();
  await expect(page.getByRole('status')).toContainText('Estado da cama actualizado');
  await expect(page.getByRole('button', { name: /Cama MI-04/ })).toContainText('Em manutenção');
  // Uma cama ocupada não abre o diálogo de estado.
  await expect(page.getByRole('button', { name: /Cama MI-03/ })).toBeDisabled();
});
