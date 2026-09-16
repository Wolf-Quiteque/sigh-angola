import { test, expect } from '@playwright/test';

test('fase 7: indicadores reconciliam com os registos e agregam por território', async ({
  page,
}) => {
  await page.goto('/internamento');
  await page.getByLabel('Perfil do utilizador').selectOption('Médico');
  const occupancy = await page
    .getByRole('row')
    .filter({ hasText: 'Beatriz Joaquim Kapenda' })
    .count();
  expect(occupancy).toBe(1);

  await page.getByRole('link', { name: 'Indicadores' }).click();
  const consultations = page.locator('.indicator-card').filter({ hasText: 'Consultas realizadas' });
  await expect(consultations).toContainText('2');
  const occupancyCard = page.locator('.indicator-card').filter({ hasText: 'Taxa de ocupação' });
  await expect(occupancyCard).toContainText('cama(s) operacional(is)');
  const stay = page.locator('.indicator-card').filter({ hasText: 'Média de permanência' });
  await expect(stay).toContainText('dias');
  await page.screenshot({ path: 'test-results/analytics-board.png', fullPage: true });

  // Reduzir o intervalo a hoje deixa os indicadores do período a zero.
  await page.getByLabel('De', { exact: true }).fill(new Date().toISOString().slice(0, 10));
  await expect(consultations).toContainText('0');

  await page.getByRole('tab', { name: 'Nacional' }).click();
  const totals = page.getByRole('row').filter({ hasText: 'Total nacional' });
  await expect(totals).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'Hospital Provincial da Huíla' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Município' }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'Hospital Provincial da Huíla' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('row').filter({ hasText: 'Hospital Municipal de Menongue' }),
  ).toBeVisible();
});

test('fase 7: utilizadores, matriz de permissões e recuperação simulada', async ({ page }) => {
  await page.goto('/utilizadores');
  await expect(page.getByRole('row').filter({ hasText: 'ana.manuel' })).toContainText(
    'Administrador',
  );
  const matrix = page.getByRole('row').filter({ hasText: 'Gestão de utilizadores' });
  await expect(matrix.getByLabel('Permitido', { exact: true })).toHaveCount(1);

  await page.getByRole('button', { name: 'Novo utilizador' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Nome de utilizador').fill('ana.manuel');
  await form.getByLabel('Nome *', { exact: false }).first().fill('Maria Sebastião');
  await form.getByRole('button', { name: 'Guardar utilizador' }).click();
  await expect(form.getByRole('alert')).toContainText('já está atribuído');
  await form.getByLabel('Nome de utilizador').fill('maria.sebastiao');
  await form.getByRole('button', { name: 'Guardar utilizador' }).click();
  await expect(page.getByRole('status')).toContainText('Utilizador criado');
  await expect(page.getByRole('row').filter({ hasText: 'maria.sebastiao' })).toBeVisible();

  const admin = page.getByRole('row').filter({ hasText: 'ana.manuel' });
  await admin.getByRole('button', { name: 'Recuperar acesso' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Registar pedido' }).click();
  await expect(page.getByRole('status')).toContainText('Recuperação de acesso iniciada');
  await expect(admin).toContainText('Recuperação pedida');

  // O perfil de leitura não gere utilizadores.
  await page.getByLabel('Perfil do utilizador').selectOption('Direcção');
  await expect(page.getByRole('button', { name: 'Novo utilizador' })).toHaveCount(0);
  await expect(page.getByText('Seleccione o perfil Administrador')).toBeVisible();
});

test('fase 7: cartão do paciente com QR do identificador e auditoria de acesso', async ({
  page,
}) => {
  await page.goto('/pacientes');
  await page.getByLabel('Perfil do utilizador').selectOption('Direcção');
  await page
    .getByRole('link', { name: /Esperança Manuel Zua/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Cartão do paciente' }).click();
  const card = page.locator('#patient-card');
  await expect(card).toContainText('SIGH-000001');
  await expect(card).toContainText('Esperança Manuel Zua');
  const qr = card.getByRole('img', { name: /Código QR com o identificador SIGH-000001/ });
  await expect(qr).toBeVisible();
  await page.screenshot({ path: 'test-results/patient-card.png', fullPage: true });
  await page.getByRole('button', { name: 'Fechar' }).first().click();

  await page.getByRole('link', { name: 'Utilizadores e permissões' }).click();
  const access = page.getByRole('row').filter({ hasText: 'SIGH-000001' });
  await expect(access).toContainText('Ficha do paciente');
  await expect(access).toContainText('Direcção');
});
