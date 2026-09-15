import { test, expect } from '@playwright/test';

test('fase 2: triagem, consulta, prescrição, conclusão e processo longitudinal', async ({
  page,
}) => {
  await page.goto('/triagem');
  await page.getByLabel('Perfil de demonstração').selectOption('Enfermeiro');
  const patientRow = page.getByRole('row').filter({ hasText: 'Esperança Manuel Zua' });
  await patientRow.getByRole('button', { name: 'Realizar triagem' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Queixa principal').fill('Dor abdominal com início há dois dias');
  await dialog.getByLabel('Prioridade atribuída').selectOption('Laranja');
  await dialog.getByLabel('Temperatura').fill('37.2');
  await dialog.getByLabel('Saturação O₂').fill('97');
  await dialog.getByRole('button', { name: 'Concluir triagem' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(patientRow).toHaveCount(0);

  await page.getByRole('link', { name: 'Consultas médicas' }).click();
  await page.getByLabel('Perfil de demonstração').selectOption('Médico');
  const consultRow = page.getByRole('row').filter({ hasText: 'Esperança Manuel Zua' });
  await expect(consultRow).toContainText('Laranja');
  await consultRow.getByRole('link', { name: 'Abrir consulta' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esperança Manuel Zua');
  await page.getByRole('button', { name: 'Iniciar consulta' }).click();
  await page.getByLabel('História clínica').fill('Sem antecedentes clínicos relevantes.');
  await page.getByLabel('Alergias').fill('Nega alergias conhecidas.');
  await page.getByLabel('Diagnóstico').fill('Gastrite aguda de demonstração');
  await page.getByLabel('Procedimentos').fill('Exame físico geral');
  await page
    .getByLabel('Evolução / plano')
    .fill('Alta com orientação, hidratação e reavaliação se necessário.');
  await page.getByRole('button', { name: 'Adicionar medicamento' }).click();
  await page.getByLabel('Medicamento').fill('Omeprazol');
  await page.getByLabel('Dose').fill('20 mg');
  await page.getByLabel('Frequência').fill('1 vez por dia');
  await page.getByLabel('Duração').fill('7 dias');
  await page.getByLabel('Quantidade').fill('7');
  await page.screenshot({ path: 'test-results/clinical-workspace.png', fullPage: true });
  await page.getByRole('button', { name: 'Guardar rascunho' }).click();
  await expect(page.getByRole('status')).toContainText('Consulta guardada');
  await page.getByLabel('Destino após consulta').selectOption('Alta ambulatória');
  await page.getByRole('button', { name: 'Concluir consulta' }).click();
  await expect(page).toHaveURL(/\/consultas$/);

  await page.getByRole('link', { name: 'Pacientes', exact: true }).click();
  await page.getByPlaceholder('Pesquisar por nome').fill('Esperança Manuel Zua');
  await page
    .getByRole('link', { name: /Esperança Manuel Zua/ })
    .first()
    .click();
  await page.getByRole('link', { name: 'Abrir registo clínico' }).click();
  await expect(page.getByRole('heading', { name: 'Consulta concluída' })).toBeVisible();
  await expect(page.getByText('Gastrite aguda de demonstração')).toBeVisible();
  await expect(page.getByText(/Omeprazol · 20 mg/)).toBeVisible();
  await expect(page.getByText('Dispensado 0 de 7')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Gastrite aguda de demonstração')).toBeVisible();
  await page.getByRole('button', { name: 'Nova adenda' }).click();
  await page.getByLabel('Motivo da adenda').fill('Clarificação do plano');
  await page.getByLabel('Conteúdo').fill('Manter hidratação oral conforme tolerância.');
  await page.getByRole('button', { name: 'Registar adenda' }).click();
  await expect(page.getByText('Manter hidratação oral conforme tolerância.')).toBeVisible();
});

test('perfil de recepção não consegue executar acções clínicas', async ({ page }) => {
  await page.goto('/triagem');
  await page.getByLabel('Perfil de demonstração').selectOption('Recepcionista');
  await expect(page.getByRole('button', { name: 'Realizar triagem' }).first()).toBeDisabled();
  await page.goto('/clinica/e1');
  await expect(page.getByRole('button', { name: 'Iniciar consulta' })).toBeDisabled();
});
