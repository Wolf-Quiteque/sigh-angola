import { test, expect } from '@playwright/test';

test('fase 8: fila de envio, reenvio idempotente e conflito resolvido à mão', async ({ page }) => {
  await page.goto('/triagem');
  await page.getByLabel('Perfil do utilizador').selectOption('Enfermeiro');
  await page
    .getByRole('row')
    .filter({ hasText: 'Esperança Manuel Zua' })
    .getByRole('button', { name: 'Realizar triagem' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Queixa principal').fill('Febre há dois dias, registada offline');
  await dialog.getByRole('button', { name: 'Concluir triagem' }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole('link', { name: 'Sincronização e cópias' }).click();
  const queue = page.locator('.panel').filter({ hasText: 'Fila de envio' });
  const queued = queue.getByRole('row').filter({ hasText: 'Triagem concluída' });
  await expect(queued).toContainText('Pendente');
  await expect(page.getByText('Armazenamento: IndexedDB')).toBeVisible();

  // Sem rede: a operação fica com erro mas nunca se perde.
  await page.getByLabel('Trabalhar sem rede no próximo envio').check();
  await page.getByRole('button', { name: 'Sincronizar agora' }).click();
  await expect(queued).toContainText('Erro');
  await expect(queued).toContainText('Sem ligação ao servidor');
  await expect(queued).toContainText('1 tentativa(s)');

  await page.getByLabel('Trabalhar sem rede no próximo envio').uncheck();
  await page.getByRole('button', { name: 'Sincronizar agora' }).click();
  await expect(queued).toContainText('Confirmado');
  const serverPanel = page.locator('.panel').filter({ hasText: 'Servidor central' });
  await expect(serverPanel.getByRole('row').filter({ hasText: 'Triagem concluída' })).toHaveCount(
    1,
  );
  await page.screenshot({ path: 'test-results/sync-board.png', fullPage: true });

  // Uma nova operação entra na fila e entra em conflito com o servidor.
  await page.getByRole('link', { name: 'Consultas médicas' }).click();
  await page.getByLabel('Perfil do utilizador').selectOption('Médico');
  await page
    .getByRole('row')
    .filter({ hasText: 'Esperança Manuel Zua' })
    .getByRole('link', { name: 'Abrir consulta' })
    .click();
  await page.getByRole('button', { name: 'Iniciar consulta' }).click();
  await page.getByRole('link', { name: 'Sincronização e cópias' }).click();
  await page.getByRole('button', { name: 'Receber alteração de outro dispositivo' }).click();
  await page.getByRole('button', { name: 'Sincronizar agora' }).click();
  const conflicted = queue.getByRole('row').filter({ hasText: 'Consulta iniciada' });
  await expect(conflicted).toContainText('Conflito');
  await conflicted.getByRole('button', { name: 'Resolver' }).click();
  const resolve = page.getByRole('dialog');
  await resolve.getByLabel('Versão a manter').selectOption('local');
  await resolve.getByRole('button', { name: 'Aplicar decisão' }).click();
  await expect(page.getByRole('status')).toContainText('Conflito de sincronização resolvido');
  await expect(conflicted).toContainText('Pendente');

  // Arquivar só remove o que já está confirmado.
  await page.getByRole('button', { name: 'Arquivar confirmadas' }).click();
  await expect(queue.getByRole('row').filter({ hasText: 'Triagem concluída' })).toHaveCount(0);
  await expect(conflicted).toContainText('Pendente');
  await page.reload();
  await expect(
    page.locator('.panel').filter({ hasText: 'Fila de envio' }).getByRole('row').filter({
      hasText: 'Consulta iniciada',
    }),
  ).toContainText('Pendente');
});

test('fase 8: a demo abre e regista sem rede, e recupera a ligação', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  // O service worker guarda o que a aplicação já abriu; visitamos os ecrãs antes de perder a rede.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 15000,
  });
  await page.goto('/pacientes');
  await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Sem ligação' })).toBeVisible();

  await page.getByRole('button', { name: 'Novo paciente' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Nome completo').fill('Paciente Registado Sem Rede');
  await form.getByLabel('Data de nascimento').fill('1990-05-10');
  await form.getByLabel('Município').fill('Menongue');
  await form.getByRole('button', { name: 'Registar paciente' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Paciente registado' })).toBeVisible();

  await page.reload();
  await page.getByPlaceholder('Pesquisar por nome').fill('Paciente Registado Sem Rede');
  await expect(page.getByText('Paciente Registado Sem Rede')).toBeVisible();

  await context.setOffline(false);
  await page.goto('/sincronizacao');
  await page.getByRole('button', { name: 'Sincronizar agora' }).click();
  await expect(
    page
      .locator('.panel')
      .filter({ hasText: 'Fila de envio' })
      .getByRole('row')
      .filter({ hasText: 'Paciente registado' }),
  ).toContainText('Confirmado');
});

test('fase 8: restauro valida a cópia e preserva o que não foi confirmado', async ({ page }) => {
  await page.goto('/sincronizacao');
  // A demo grava o cenário inicial ao abrir; esperamos que esteja em IndexedDB.
  await page.waitForFunction(
    async () => {
      const open = indexedDB.open('sigh-angola', 1);
      const database = await new Promise<IDBDatabase | null>((resolve) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => resolve(null);
      });
      if (!database || !database.objectStoreNames.contains('estado')) return false;
      return await new Promise<boolean>((resolve) => {
        const request = database
          .transaction('estado', 'readonly')
          .objectStore('estado')
          .get('sigh-angola-unidade-v1');
        request.onsuccess = () => resolve(typeof request.result === 'string');
        request.onerror = () => resolve(false);
      });
    },
    null,
    { timeout: 15000 },
  );
  const backup = await page.evaluate(async () => {
    const open = indexedDB.open('sigh-angola', 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains('estado'))
          open.result.createObjectStore('estado');
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    return await new Promise<string>((resolve, reject) => {
      const request = database
        .transaction('estado', 'readonly')
        .objectStore('estado')
        .get('sigh-angola-unidade-v1');
      request.onsuccess = () => resolve(request.result as string);
      request.onerror = () => reject(request.error);
    });
  });
  expect(backup).toContain('SIGH-000001');

  await page.getByRole('link', { name: 'Pacientes', exact: true }).click();
  await page.getByRole('button', { name: 'Novo paciente' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Nome completo').fill('Paciente Depois da Cópia');
  await form.getByLabel('Data de nascimento').fill('1985-03-22');
  await form.getByLabel('Município').fill('Menongue');
  await form.getByRole('button', { name: 'Registar paciente' }).click();
  await expect(page.getByRole('status')).toContainText('Paciente registado');

  await page.getByRole('link', { name: 'Sincronização e cópias' }).click();
  await page.getByRole('button', { name: 'Restaurar' }).click();
  const restore = page.getByRole('dialog');
  await restore.getByLabel('Conteúdo da cópia').fill('{"version":1,"isto":"não serve"}');
  await restore.getByRole('button', { name: 'Validar e restaurar' }).click();
  await expect(restore.getByRole('alert')).toContainText('não corresponde');
  await restore.getByLabel('Conteúdo da cópia').fill(backup);
  await restore.getByRole('button', { name: 'Validar e restaurar' }).click();
  await expect(page.getByRole('status')).toContainText('Cópia de segurança restaurada');

  // O paciente criado depois da cópia desaparece, mas a operação por confirmar fica na fila.
  await expect(
    page
      .locator('.panel')
      .filter({ hasText: 'Fila de envio' })
      .getByRole('row')
      .filter({ hasText: 'Paciente registado' }),
  ).toContainText('Pendente');
  await page.getByRole('link', { name: 'Pacientes', exact: true }).click();
  await page.getByPlaceholder('Pesquisar por nome').fill('Paciente Depois da Cópia');
  await expect(page.getByText('Nenhum paciente encontrado')).toBeVisible();
});
