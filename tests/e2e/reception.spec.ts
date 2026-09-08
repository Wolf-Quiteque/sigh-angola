import { test, expect } from '@playwright/test';

test('percurso completo: registo, marcação, confirmação, chegada, persistência e auditoria', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await page.getByRole('button', { name: 'Novo paciente', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome completo').fill('Marta Teste de Integração');
  await dialog.getByLabel('Data de nascimento').fill('1992-03-15');
  await dialog.getByLabel('Sexo').selectOption('Feminino');
  await dialog.getByLabel('Bilhete de identidade').fill('TESTE-E2E-001');
  await dialog.getByLabel('Telefone', { exact: true }).fill('923444555');
  await dialog.getByRole('button', { name: 'Registar paciente', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Pacientes', exact: true }).click();
  await page.getByPlaceholder('Pesquisar por nome').fill('Marta Teste');
  await page
    .getByRole('link', { name: /Marta Teste de Integração/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marta Teste de Integração');
  await page.getByRole('button', { name: 'Marcar consulta', exact: true }).click();
  await dialog.getByLabel('Hora').fill('14:00');
  await dialog.getByLabel('Motivo da consulta').fill('Consulta de demonstração');
  await dialog.getByRole('button', { name: 'Marcar consulta', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Agenda de consultas', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirmar consulta de Marta Teste de Integração' })
    .click();
  const row = page.getByRole('row').filter({ hasText: 'Marta Teste de Integração' });
  await expect(row).toContainText('Confirmada');
  await page.getByRole('button', { name: 'Registar chegada de Marta Teste de Integração' }).click();
  await expect(row).toContainText('Admitida');
  await page.getByRole('link', { name: /Fila de atendimento/ }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'Marta Teste de Integração' }),
  ).toContainText('Aguarda triagem');
  await page.reload();
  await expect(
    page.getByRole('row').filter({ hasText: 'Marta Teste de Integração' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Registo de actividade' }).click();
  await expect(page.getByRole('cell', { name: 'Paciente registado', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Chegada registada', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('duplicado mostra erro e perfil de direcção não pode escrever', async ({ page }) => {
  await page.goto('/pacientes');
  await page.getByRole('button', { name: 'Novo paciente' }).click();
  await page.getByLabel('Nome completo').fill('Outro Nome de Teste');
  await page.getByLabel('Data de nascimento').fill('1990-01-01');
  await page.getByLabel('Bilhete de identidade').fill('DEMO000001');
  await page.getByRole('button', { name: 'Registar paciente', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Já existe um paciente');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByLabel('Perfil de demonstração').selectOption('Direcção');
  await expect(page.getByRole('button', { name: 'Novo paciente' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Agenda de consultas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Marcar consulta' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Configurações', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Repor dados de demonstração' })).toBeDisabled();
});
test('reagendamento, cancelamento, exportação e reset alteram dados reais da demo', async ({
  page,
}) => {
  await page.goto('/agenda');
  await page.getByRole('button', { name: 'Reagendar consulta de Lúcia Domingos Mateus' }).click();
  await page.getByRole('dialog').getByLabel('Hora').fill('12:30');
  await page.getByRole('button', { name: 'Guardar reagendamento' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Lúcia Domingos Mateus' });
  await expect(row).toContainText('12:30');
  await expect(row).toContainText('Marcada');
  await page.getByRole('button', { name: 'Cancelar consulta de Lúcia Domingos Mateus' }).click();
  await page.getByLabel('Motivo do cancelamento').fill('Teste de cancelamento');
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(row).toContainText('Cancelada');
  await page.getByRole('link', { name: 'Configurações', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON' }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/^sigh-demo-.*\.json$/);
  await page.getByRole('button', { name: 'Repor dados de demonstração' }).click();
  await page.getByLabel('Escreva REPOR').fill('REPOR');
  await page.getByRole('button', { name: 'Repor cenário', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Agenda de consultas', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Lúcia Domingos Mateus' })).toContainText(
    'Confirmada',
  );
});
test('tablet e telemóvel, modal por teclado e recuperação de dados inválidos', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-tablet.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('link', { name: 'Pacientes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Novo paciente' }).click();
  await expect(page.getByLabel('Nome completo')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo paciente' })).toBeFocused();
  await page.screenshot({ path: 'test-results/patients-mobile.png', fullPage: true });
  await page.evaluate(() => localStorage.setItem('sigh-angola-demo-v1', '{broken'));
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Não foi possível abrir os dados' }),
  ).toBeVisible();
});
test('painel desktop sem pedidos API externos', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:3100') && !r.url().startsWith('data:'))
      external.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  expect(external).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
