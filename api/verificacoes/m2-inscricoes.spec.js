import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarServidor } from '../src/server.js';

async function iniciarApi() {
  const app = criarServidor({ modoTeste: true });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    async fechar() {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

async function requisitarJson(baseUrl, caminho, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', 'X-Usuario': 'org-ana', ...opcoes.headers },
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

describe('M2 inscricoes - fatia 1', () => {
  let api;

  beforeEach(async () => {
    api = await iniciarApi();
    await fetch(`${api.baseUrl}/_teste/reset`, { method: 'POST' });
  });

  afterEach(async () => api.fechar());

  it('fecha inscricoes exatamente 30 minutos antes do primeiro encontro', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', {
      method: 'POST',
      body: JSON.stringify({
        titulo: 'Inscricao com fechamento',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 1,
        encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }],
      }),
    });

    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T18:29:59-03:00' }),
    });
    const aceita = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T18:30:00-03:00' }),
    });
    const fechada = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });

    expect(aceita.status).toBe(201);
    expect(fechada.status).toBe(422);
    expect(fechada.corpo.erro).toBe('INSCRICOES_ENCERRADAS');
  });

  it('coloca a segunda pessoa no fim da espera quando as vagas acabam', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', {
      method: 'POST',
      body: JSON.stringify({ titulo: 'Fila', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }),
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:00:00-03:00' }) });
    const primeira = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const segunda = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    const lista = await requisitarJson(api.baseUrl, '/inscricoes', { headers: { 'X-Usuario': 'p-diego' } });

    expect(primeira.corpo.status).toBe('confirmada');
    expect(segunda.corpo.status).toBe('em_espera');
    expect(lista.status).toBe(200);
    expect(lista.corpo[0]).toMatchObject({ id: segunda.corpo.id, posicaoNaEspera: 1 });
  });

  it('recusa inscricao ativa duplicada e permite nova depois do cancelamento', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Duplicidade', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    const primeira = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const duplicada = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const cancelada = await requisitarJson(api.baseUrl, `/inscricoes/${primeira.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const nova = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    expect(duplicada.status).toBe(409);
    expect(duplicada.corpo.erro).toBe('JA_INSCRITO');
    expect(cancelada.status).toBe(200);
    expect(nova.status).toBe(201);
  });

  it('convoca a primeira pessoa da fila ao cancelar uma vaga ocupada', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Promocao', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:00:00-03:00' }) });
    const carla = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const diego = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const leitura = await requisitarJson(api.baseUrl, `/inscricoes/${diego.corpo.id}`, { headers: { 'X-Usuario': 'p-diego' } });
    expect(leitura.corpo.status).toBe('convocada');
    expect(leitura.corpo.convocadaAte).toBe('2026-10-20T21:30:00.000Z');
  });

  it('confirma convocacao e limpa o prazo sem alterar a criacao', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Confirmacao', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:00:00-03:00' }) });
    const carla = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const diego = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const confirmada = await requisitarJson(api.baseUrl, `/inscricoes/${diego.corpo.id}/confirmacao`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    expect(confirmada.status).toBe(200);
    expect(confirmada.corpo).toMatchObject({ status: 'confirmada', criadaEm: '2026-10-20T18:00:00-03:00', posicaoNaEspera: null, convocadaAte: null });
  });

  it('convoca uma pessoa por cada vaga aumentada antes do fechamento', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Aumento', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:01:00-03:00' }) });
    await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const fila = [];
    for (const participante of ['p-diego', 'p-elisa', 'p-fabio']) fila.push(await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': participante } }));
    const alterada = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}`, { method: 'PATCH', body: JSON.stringify({ vagas: 4 }) });
    const convocadas = await requisitarJson(api.baseUrl, `/inscricoes?atividadeId=${atividade.corpo.id}`, { headers: { 'X-Usuario': 'org-ana' } });
    expect(alterada.status).toBe(200);
    expect(convocadas.corpo.filter((inscricao) => inscricao.status === 'convocada')).toHaveLength(3);
    expect(fila).toHaveLength(3);
  });
});
