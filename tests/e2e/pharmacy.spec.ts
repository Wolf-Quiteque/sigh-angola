import { test, expect } from '@playwright/test';

test('fase 5: entrada, requisição, ajuste e dispensação parcial ligada à prescrição', async ({
  page,
}) => {
  await page.goto('/farmacia');
  await page.getByLabel('Perfil do utilizador').selectOption('Farmacêutico');
  const paracetamol = page.getByRole('row').filter({ hasText: 'Paracetamol 500 mg' });
  await expect(paracetamol).toContainText('620 Comprimido');

  await paracetamol.getByRole('button', { name: 'Registar entrada' }).click();
  const entry = page.getByRole('dialog');
  await entry.getByLabel('Lote ou referência').fill('L-PAR-2602');
  await entry.getByLabel('Quantidade recebida').fill('300');
  await entry.getByLabel('Fornecedor').selectOption({ label: 'Farmédica Angola, Lda.' });
  await entry.getByRole('button', { name: 'Registar entrada' }).click();
  await expect(page.getByRole('status')).toContainText('Entrada de stock');
  await expect(paracetamol).toContainText('920 Comprimido');

  await paracetamol.getByRole('button', { name: 'Requisitar para serviço' }).click();
  const transfer = page.getByRole('dialog');
  // O lote novo é o segundo da lista deste artigo.
  await transfer.getByLabel('Lote').selectOption({ index: 1 });
  await transfer.getByLabel('Quantidade').fill('100');
  await transfer.getByLabel('Serviço de destino').fill('Enfermaria de Medicina');
  await transfer.getByLabel('Justificação').fill('Requisição diária da enfermaria.');
  await transfer.getByRole('button', { name: 'Requisitar para serviço' }).click();
  await expect(page.getByRole('status')).toContainText('Requisição de serviço');
  await expect(paracetamol).toContainText('820 Comprimido');

  await paracetamol.getByRole('button', { name: 'Ajustar inventário' }).click();
  const adjust = page.getByRole('dialog');
  await adjust.getByLabel('Lote').selectOption({ index: 0 });
  await adjust.getByLabel('Quantidade contada').fill('620');
  await adjust.getByLabel('Justificação').fill('Contagem física do armazém.');
  await adjust.getByRole('button', { name: 'Ajustar inventário' }).click();
  await expect(adjust.getByRole('alert')).toContainText('igual ao stock registado');
  await adjust.getByLabel('Quantidade contada').fill('610');
  await adjust.getByRole('button', { name: 'Ajustar inventário' }).click();
  await expect(page.getByRole('status')).toContainText('Ajuste de inventário');

  await page.getByRole('tab', { name: 'Dispensação' }).click();
  const prescription = page.getByRole('row').filter({ hasText: 'Soro fisiológico' });
  await expect(prescription).toContainText('6 de 6');
  await prescription.getByRole('button', { name: 'Dispensar' }).click();
  const dispense = page.getByRole('dialog');
  await dispense.getByLabel('Lote a debitar').selectOption('b-sf-1');
  await dispense.getByLabel('Quantidade a dispensar').fill('2');
  await dispense.getByRole('button', { name: 'Registar dispensação' }).click();
  await expect(page.getByRole('status')).toContainText('Dispensação parcial');
  await expect(prescription).toContainText('4 de 6');
  await expect(prescription).toContainText('Dispensação parcial');
  await page.screenshot({ path: 'test-results/pharmacy-board.png', fullPage: true });

  await page.getByRole('tab', { name: 'Movimentos' }).click();
  const ledger = page.getByRole('row').filter({ hasText: 'Soro fisiológico' }).first();
  await expect(ledger).toContainText('Dispensação');
  await expect(ledger).toContainText('−2');
  await page.reload();
  await page.getByRole('tab', { name: 'Stock e lotes' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Paracetamol 500 mg' })).toContainText(
    '810 Comprimido',
  );
});

test('alertas de stock mínimo e de validade bloqueiam o que devem bloquear', async ({ page }) => {
  await page.goto('/farmacia');
  await page.getByLabel('Perfil do utilizador').selectOption('Farmacêutico');
  const amoxicilina = page.getByRole('row').filter({ hasText: 'Amoxicilina 500 mg' });
  await expect(amoxicilina).toContainText('Abaixo do mínimo');
  const omeprazol = page.getByRole('row').filter({ hasText: 'Omeprazol 20 mg' });
  await expect(omeprazol).toContainText('Expirado');

  await amoxicilina.getByRole('button', { name: 'Registar saída' }).click();
  const exit = page.getByRole('dialog');
  await exit.getByLabel('Quantidade').fill('500');
  await exit.getByLabel('Justificação').fill('Tentativa acima do stock disponível.');
  await exit.getByRole('button', { name: 'Registar saída' }).click();
  await expect(exit.getByRole('alert')).toContainText('não pode ficar negativo');
  await exit.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('tab', { name: 'Dispensação' }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'Soro fisiológico' })
    .getByRole('button', { name: 'Dispensar' })
    .click();
  const dispense = page.getByRole('dialog');
  await dispense.getByLabel('Lote a debitar').selectOption('b-ome-1');
  await dispense.getByLabel('Quantidade a dispensar').fill('1');
  await dispense.getByRole('button', { name: 'Registar dispensação' }).click();
  await expect(dispense.getByRole('alert')).toContainText('expirou');
});

test('perfis sem farmácia não movimentam stock', async ({ page }) => {
  await page.goto('/farmacia');
  await page.getByLabel('Perfil do utilizador').selectOption('Médico');
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Paracetamol 500 mg' })
      .getByRole('button', { name: 'Registar entrada' }),
  ).toBeDisabled();
  await expect(page.getByText('Seleccione o perfil Farmacêutico')).toBeVisible();
});
