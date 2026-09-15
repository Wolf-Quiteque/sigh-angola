import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Fase 9 — verificações transversais de acessibilidade, estados vazios e
 * comportamento em tablet e telemóvel. Não substitui uma auditoria formal.
 */
const screens = [
  ['/', 'Visão geral'],
  ['/pacientes', 'Pacientes'],
  ['/agenda', 'Agenda de consultas'],
  ['/atendimento', 'Fila de atendimento'],
  ['/triagem', 'Triagem'],
  ['/consultas', 'Consultas médicas'],
  ['/exames', 'Laboratório e imagiologia'],
  ['/internamento', 'Enfermarias e camas'],
  ['/farmacia', 'Medicamentos, materiais e stock'],
  ['/financas', 'Facturação e caixa'],
  ['/recursos-humanos', 'Colaboradores e escalas'],
  ['/indicadores', 'Indicadores hospitalares'],
  ['/utilizadores', 'Utilizadores e permissões'],
  ['/sincronizacao', 'Fila de envio e cópias de segurança'],
  ['/auditoria', 'Registo de actividade'],
  ['/configuracoes', 'Configurações'],
  ['/roteiro', 'Roteiro da plataforma'],
] as const;

const analyse = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

for (const [path, heading] of screens) {
  test(`acessibilidade: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    // Um e um só título de primeiro nível por ecrã.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const results = await analyse(page);
    expect(
      results.violations.map((violation) => `${violation.id}: ${violation.help}`),
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
    // Nenhum ecrã obriga a deslocar a página na horizontal.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
  });
}

test('acessibilidade: diálogos e mensagens de erro', async ({ page }) => {
  await page.goto('/pacientes');
  await page.getByRole('button', { name: 'Novo paciente' }).click();
  await expect(page.getByLabel('Nome completo')).toBeFocused();
  const results = await analyse(page);
  expect(
    results.violations.map((v) => v.id),
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
  // Um erro do domínio é anunciado como alerta dentro do próprio diálogo.
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome completo').fill('Esperança Manuel Zua');
  await dialog.getByLabel('Data de nascimento').fill('1988-04-12');
  await dialog.getByLabel('Município').fill('Menongue');
  await dialog.getByRole('button', { name: 'Registar paciente' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Já existe um paciente');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Novo paciente' })).toBeFocused();
});

test('navegação apenas com teclado a partir do atalho de conteúdo', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeVisible();
  // O menu lateral é alcançável e activável com o teclado.
  await page.getByRole('link', { name: 'Indicadores' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Indicadores hospitalares');
});

test('estados vazios explicam o que fazer em vez de mostrarem tabelas vazias', async ({ page }) => {
  await page.goto('/pacientes');
  await page.getByPlaceholder('Pesquisar por nome').fill('nome que não existe');
  await expect(page.getByText('Nenhum paciente encontrado')).toBeVisible();
  await page.goto('/internamento');
  await expect(page.getByText('Ninguém a aguardar cama')).toBeVisible();
  await page.goto('/financas');
  await page.getByRole('tab', { name: 'Facturas' }).click();
  await page.getByPlaceholder('Pesquisar número de factura').fill('FT-999999');
  await expect(page.getByText('Sem facturas emitidas')).toBeVisible();
});

test('tablet e telemóvel: navegação, tabelas e diálogos continuam utilizáveis', async ({
  page,
}) => {
  for (const [width, height] of [
    [768, 1024],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const path of ['/', '/exames', '/internamento', '/farmacia', '/indicadores']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        `${path} a ${width}px não deve deslocar-se na horizontal`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/farmacia');
  await page.screenshot({ path: 'test-results/farmacia-telemovel.png', fullPage: true });
  await page.goto('/indicadores');
  await page.screenshot({ path: 'test-results/indicadores-tablet.png', fullPage: true });
});

test('o cartão do paciente está preparado para impressão', async ({ page }) => {
  await page.goto('/pacientes');
  await page
    .getByRole('link', { name: /Esperança Manuel Zua/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Cartão do paciente' }).click();
  await page.emulateMedia({ media: 'print' });
  const card = page.locator('#patient-card');
  await expect(card).toBeVisible();
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.screenshot({ path: 'test-results/cartao-impressao.png' });
  await page.emulateMedia({ media: 'screen' });
});
