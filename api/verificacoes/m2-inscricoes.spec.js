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

  it('aplica a ordem de recusas da nova inscricao', async () => {
    const inexistente = await requisitarJson(api.baseUrl, '/atividades/atv_inexistente/inscricoes', { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const cancelada = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Cancelada na ordem', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, `/atividades/${cancelada.corpo.id}/cancelamento`, { method: 'POST' });
    const erroCancelada = await requisitarJson(api.baseUrl, `/atividades/${cancelada.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const fechada = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Fechada na ordem', tipo: 'palestra', salaId: 'sala-101', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:30:00-03:00' }) });
    const erroFechada = await requisitarJson(api.baseUrl, `/atividades/${fechada.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });

    expect(inexistente).toMatchObject({ status: 404, corpo: { erro: 'NAO_ENCONTRADO' } });
    expect(erroCancelada).toMatchObject({ status: 422, corpo: { erro: 'ATIVIDADE_CANCELADA' } });
    expect(erroFechada).toMatchObject({ status: 422, corpo: { erro: 'INSCRICOES_ENCERRADAS' } });
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

  it('prioriza atividade iniciada ao cancelar inscricao inativa', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', {
      method: 'POST',
      body: JSON.stringify({ titulo: 'Precedencia', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }),
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:00:00-03:00' }) });
    const inscricao = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, `/inscricoes/${inscricao.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T19:00:00-03:00' }) });

    const resposta = await requisitarJson(api.baseUrl, `/inscricoes/${inscricao.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('ATIVIDADE_JA_INICIADA');
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

  it('recusa duplicidade em espera e convocada e reinsere no fim da fila', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Estados ativos', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:00:00-03:00' }) });
    const carla = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:01:00-03:00' }) });
    const diego = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:02:00-03:00' }) });
    const elisa = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-elisa' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:03:00-03:00' }) });
    const gabriela = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-gabriela' } });
    const esperaDuplicada = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const convocadaDuplicada = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    const canceladaConvocada = await requisitarJson(api.baseUrl, `/inscricoes/${diego.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:04:00-03:00' }) });
    const reinscricao = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    const lista = await requisitarJson(api.baseUrl, `/inscricoes?atividadeId=${atividade.corpo.id}`, { headers: { 'X-Usuario': 'org-ana' } });

    expect(esperaDuplicada.corpo.erro).toBe('JA_INSCRITO');
    expect(convocadaDuplicada.corpo.erro).toBe('JA_INSCRITO');
    expect(canceladaConvocada.status).toBe(200);
    expect(reinscricao.status).toBe(201);
    expect(lista.corpo.find((item) => item.id === elisa.corpo.id).status).toBe('convocada');
    expect(lista.corpo.find((item) => item.id === gabriela.corpo.id).posicaoNaEspera).toBe(1);
    expect(lista.corpo.find((item) => item.id === reinscricao.corpo.id).posicaoNaEspera).toBe(2);
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

  it('aplica os erros corretos para atividade cancelada, convocacao expirada e espera', async () => {
    const cancelada = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Cancelada', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:00:00-03:00' }) });
    const inscricaoCancelada = await requisitarJson(api.baseUrl, `/atividades/${cancelada.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, `/atividades/${cancelada.corpo.id}/cancelamento`, { method: 'POST' });
    const erroAtividade = await requisitarJson(api.baseUrl, `/inscricoes/${inscricaoCancelada.corpo.id}/confirmacao`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });

    const expirada = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Expirada', tipo: 'palestra', salaId: 'sala-101', vagas: 1, encontros: [{ inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T20:00:00-03:00' }] }) });
    const titular = await requisitarJson(api.baseUrl, `/atividades/${expirada.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    const fila = await requisitarJson(api.baseUrl, `/atividades/${expirada.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-elisa' } });
    await requisitarJson(api.baseUrl, `/inscricoes/${titular.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-21T18:31:00-03:00' }) });
    const erroExpirada = await requisitarJson(api.baseUrl, `/inscricoes/${fila.corpo.id}/confirmacao`, { method: 'POST', headers: { 'X-Usuario': 'p-elisa' } });

    const espera = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Sem convocacao', tipo: 'palestra', salaId: 'sala-102', vagas: 1, encontros: [{ inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, `/atividades/${espera.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-fabio' } });
    const inscricaoEspera = await requisitarJson(api.baseUrl, `/atividades/${espera.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-gabriela' } });
    const erroEspera = await requisitarJson(api.baseUrl, `/inscricoes/${inscricaoEspera.corpo.id}/confirmacao`, { method: 'POST', headers: { 'X-Usuario': 'p-gabriela' } });

    expect(erroAtividade).toMatchObject({ status: 422, corpo: { erro: 'ATIVIDADE_CANCELADA' } });
    expect(erroExpirada).toMatchObject({ status: 422, corpo: { erro: 'CONVOCACAO_EXPIRADA' } });
    expect(erroEspera).toMatchObject({ status: 422, corpo: { erro: 'SEM_CONVOCACAO' } });
  });

  it('cancela pessoa em espera sem convocar a seguinte', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Cancelamento da fila', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:00:00-03:00' }) });
    await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const diego = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    const elisa = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-elisa' } });

    const cancelada = await requisitarJson(api.baseUrl, `/inscricoes/${diego.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    const seguinte = await requisitarJson(api.baseUrl, `/inscricoes/${elisa.corpo.id}`, { headers: { 'X-Usuario': 'p-elisa' } });

    expect(cancelada.corpo.status).toBe('cancelada');
    expect(seguinte.corpo).toMatchObject({ status: 'em_espera', posicaoNaEspera: 1 });
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

  it('materializa uma cadeia de expiracoes e convocacoes depois de um salto de varias horas', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Cadeia', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T21:00:00-03:00', fim: '2026-10-20T22:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T16:00:00-03:00' }) });
    const carla = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T16:01:00-03:00' }) });
    const diego = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T16:02:00-03:00' }) });
    const elisa = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-elisa' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T16:03:00-03:00' }) });
    const fabio = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-fabio' } });
    await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T20:05:00-03:00' }) });
    const leitura = await requisitarJson(api.baseUrl, `/inscricoes?atividadeId=${atividade.corpo.id}`, { headers: { 'X-Usuario': 'org-ana' } });

    expect(leitura.status).toBe(200);
    expect(leitura.corpo).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: diego.corpo.id, status: 'expirada', convocadaAte: null }),
      expect.objectContaining({ id: elisa.corpo.id, status: 'expirada', convocadaAte: null }),
      expect.objectContaining({ id: fabio.corpo.id, status: 'convocada', convocadaAte: '2026-10-20T23:30:00.000Z' }),
    ]));
  });

  it('trunca o prazo da convocacao no fechamento das inscricoes', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Prazo truncado', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:00:00-03:00' }) });
    const carla = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const diego = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const convocada = await requisitarJson(api.baseUrl, `/inscricoes/${diego.corpo.id}`, { headers: { 'X-Usuario': 'p-diego' } });

    expect(convocada.corpo).toMatchObject({ status: 'convocada', convocadaAte: '2026-10-20T21:30:00.000Z' });
  });

  it('nao convoca a fila quando a vaga e liberada depois do fechamento', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Vaga tardia', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:00:00-03:00' }) });
    const carla = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const diego = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:30:00-03:00' }) });
    const cancelada = await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const leitura = await requisitarJson(api.baseUrl, `/inscricoes/${diego.corpo.id}`, { headers: { 'X-Usuario': 'p-diego' } });

    expect(cancelada.status).toBe(200);
    expect(leitura.corpo).toMatchObject({ status: 'em_espera', posicaoNaEspera: 1, convocadaAte: null });
  });

  it('nao convoca novas vagas quando o aumento ocorre no fechamento', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Aumento no fechamento', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:00:00-03:00' }) });
    await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const diego = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:30:00-03:00' }) });

    const alterada = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}`, { method: 'PATCH', body: JSON.stringify({ vagas: 2 }) });
    const leitura = await requisitarJson(api.baseUrl, `/inscricoes/${diego.corpo.id}`, { headers: { 'X-Usuario': 'p-diego' } });

    expect(alterada.status).toBe(200);
    expect(leitura.corpo).toMatchObject({ status: 'em_espera', posicaoNaEspera: 1, convocadaAte: null });
  });

  it('aceita confirmacao no instante exato de convocadaAte', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Limite exato', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T16:00:00-03:00' }) });
    const carla = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const diego = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:00:00-03:00' }) });
    const confirmada = await requisitarJson(api.baseUrl, `/inscricoes/${diego.corpo.id}/confirmacao`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });

    expect(confirmada.status).toBe(200);
    expect(confirmada.corpo).toMatchObject({ status: 'confirmada', convocadaAte: null });
  });

  it('aceita encontros que apenas encostam e recusa sobreposicao de um segundo', async () => {
    const primeira = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Primeira faixa', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T12:00:00-03:00', fim: '2026-10-20T13:00:00-03:00' }] }) });
    const encostada = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Faixa seguinte', tipo: 'palestra', salaId: 'sala-101', vagas: 1, encontros: [{ inicio: '2026-10-20T13:00:00-03:00', fim: '2026-10-20T14:00:00-03:00' }] }) });
    const sobreposta = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Faixa sobreposta', tipo: 'palestra', salaId: 'sala-102', vagas: 1, encontros: [{ inicio: '2026-10-20T12:59:59-03:00', fim: '2026-10-20T14:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }) });

    const primeiraInscricao = await requisitarJson(api.baseUrl, `/atividades/${primeira.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const encostadaInscricao = await requisitarJson(api.baseUrl, `/atividades/${encostada.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const sobrepostaInscricao = await requisitarJson(api.baseUrl, `/atividades/${sobreposta.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });

    expect(primeiraInscricao.status).toBe(201);
    expect(encostadaInscricao.status).toBe(201);
    expect(sobrepostaInscricao).toMatchObject({ status: 409, corpo: { erro: 'CONFLITO_DE_HORARIO' } });
  });

  it('convoca mesmo com conflito e so recusa na confirmacao, permitindo nova tentativa', async () => {
    const conflito = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Conflito existente', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    const fila = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Convocacao cega', tipo: 'palestra', salaId: 'sala-101', vagas: 1, encontros: [{ inicio: '2026-10-20T19:30:00-03:00', fim: '2026-10-20T20:30:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:00:00-03:00' }) });
    const ocupante = await requisitarJson(api.baseUrl, `/atividades/${conflito.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, `/atividades/${fila.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    const carla = await requisitarJson(api.baseUrl, `/atividades/${fila.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const diego = await requisitarJson(api.baseUrl, '/inscricoes', { headers: { 'X-Usuario': 'org-ana', } });
    const inscricaoDiego = diego.corpo.find((inscricao) => inscricao.participanteId === 'p-diego' && inscricao.atividadeId === fila.corpo.id);
    await requisitarJson(api.baseUrl, `/inscricoes/${inscricaoDiego.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    const recusada = await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/confirmacao`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, `/inscricoes/${ocupante.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const confirmada = await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/confirmacao`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });

    expect(recusada.status).toBe(409);
    expect(recusada.corpo.erro).toBe('CONFLITO_DE_HORARIO');
    expect(confirmada.status).toBe(200);
    expect(confirmada.corpo.status).toBe('confirmada');
  });

  it('convoca mesmo no teto de minicursos e recusa somente a confirmacao', async () => {
    const atividades = [];
    for (const dia of ['19', '20', '21']) {
      atividades.push(await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: `Minicurso ${dia}`, tipo: 'minicurso', salaId: 'lab-3', vagas: 1, encontros: [{ inicio: `2026-10-${dia}T19:00:00-03:00`, fim: `2026-10-${dia}T20:00:00-03:00` }, { inicio: `2026-10-${dia}T20:30:00-03:00`, fim: `2026-10-${dia}T21:30:00-03:00` }] }) }));
    }
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-19T17:00:00-03:00' }) });
    for (const atividade of atividades) await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const quarta = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Quarto minicurso', tipo: 'minicurso', salaId: 'lab-3', vagas: 1, encontros: [{ inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T20:00:00-03:00' }, { inicio: '2026-10-22T20:30:00-03:00', fim: '2026-10-22T21:30:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, `/atividades/${quarta.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    const carla = await requisitarJson(api.baseUrl, `/atividades/${quarta.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const diego = await requisitarJson(api.baseUrl, '/inscricoes', { headers: { 'X-Usuario': 'org-ana' } });
    const ocupante = diego.corpo.find((inscricao) => inscricao.participanteId === 'p-diego' && inscricao.atividadeId === quarta.corpo.id);
    await requisitarJson(api.baseUrl, `/inscricoes/${ocupante.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    const confirmacao = await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/confirmacao`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });

    expect(confirmacao.status).toBe(422);
    expect(confirmacao.corpo.erro).toBe('LIMITE_DE_MINICURSOS');
    const leitura = await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}`, { headers: { 'X-Usuario': 'p-carla' } });
    expect(leitura.corpo.status).toBe('convocada');
  });

  it('prioriza conflito de horario quando conflito e limite falham juntos', async () => {
    const minicursos = [];
    for (const dia of ['19', '20', '21']) {
      minicursos.push(await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: `Base ${dia}`, tipo: 'minicurso', salaId: 'lab-3', vagas: 1, encontros: [{ inicio: `2026-10-${dia}T19:00:00-03:00`, fim: `2026-10-${dia}T20:00:00-03:00` }, { inicio: `2026-10-${dia}T20:30:00-03:00`, fim: `2026-10-${dia}T21:30:00-03:00` }] }) }));
    }
    const alvo = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Conflito e limite', tipo: 'minicurso', salaId: 'sala-101', vagas: 1, encontros: [{ inicio: '2026-10-19T19:30:00-03:00', fim: '2026-10-19T20:30:00-03:00' }, { inicio: '2026-10-19T21:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-19T17:00:00-03:00' }) });
    for (const atividade of minicursos) await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const ocupante = await requisitarJson(api.baseUrl, `/atividades/${alvo.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    const convocada = await requisitarJson(api.baseUrl, `/atividades/${alvo.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, `/inscricoes/${ocupante.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });

    const confirmacao = await requisitarJson(api.baseUrl, `/inscricoes/${convocada.corpo.id}/confirmacao`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });

    expect(confirmacao).toMatchObject({ status: 409, corpo: { erro: 'CONFLITO_DE_HORARIO' } });
  });

  it('produz o mesmo estado quando a primeira rota apos o salto e M1, M2 ou M3', async () => {
    const estados = [];
    for (const primeiraRota of ['m1', 'm2', 'm3']) {
      await fetch(`${api.baseUrl}/_teste/reset`, { method: 'POST' });
      const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: `Idempotencia ${primeiraRota}`, tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
      await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T16:00:00-03:00' }) });
      const carla = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
      const diego = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
      await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
      await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:05:00-03:00' }) });

      if (primeiraRota === 'm1') await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}`);
      if (primeiraRota === 'm2') await requisitarJson(api.baseUrl, `/inscricoes/${diego.corpo.id}`, { headers: { 'X-Usuario': 'p-diego' } });
      if (primeiraRota === 'm3') await requisitarJson(api.baseUrl, `/encontros/${atividade.corpo.encontros[0].id}/presencas`);

      const inscricoes = await requisitarJson(api.baseUrl, `/inscricoes?atividadeId=${atividade.corpo.id}`, { headers: { 'X-Usuario': 'org-ana' } });
      const leituraAtividade = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}`);
      estados.push({
        situacao: leituraAtividade.corpo.situacao,
        inscricoes: inscricoes.corpo
          .map(({ participanteId, status, convocadaAte }) => ({ participanteId, status, convocadaAte }))
          .sort((a, b) => a.participanteId.localeCompare(b.participanteId)),
      });
    }

    expect(estados[1]).toEqual(estados[0]);
    expect(estados[2]).toEqual(estados[0]);
  });

  it('ordena consultas, restringe detalhes e impede organizacao de operar inscricao', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Consulta', tipo: 'palestra', salaId: 'auditorio', vagas: 2, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:00:00-03:00' }) });
    const carla = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:01:00-03:00' }) });
    const diego = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });

    const listaParticipante = await requisitarJson(api.baseUrl, '/inscricoes', { headers: { 'X-Usuario': 'p-carla' } });
    const detalheAlheio = await requisitarJson(api.baseUrl, `/inscricoes/${diego.corpo.id}`, { headers: { 'X-Usuario': 'p-carla' } });
    const listaOrganizacao = await requisitarJson(api.baseUrl, `/inscricoes?atividadeId=${atividade.corpo.id}`, { headers: { 'X-Usuario': 'org-ana' } });
    const operacaoOrganizacao = await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'org-ana' } });

    expect(listaParticipante.corpo).toHaveLength(1);
    expect(listaParticipante.corpo[0].id).toBe(carla.corpo.id);
    expect(detalheAlheio).toMatchObject({ status: 404, corpo: { erro: 'NAO_ENCONTRADO' } });
    expect(listaOrganizacao.corpo.map((item) => item.id)).toEqual([diego.corpo.id, carla.corpo.id]);
    expect(operacaoOrganizacao).toMatchObject({ status: 403, corpo: { erro: 'SOMENTE_PARTICIPANTE' } });
  });

  it('reconcilia expiracao antes do registro de presenca M3', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Reconciliacao M3', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T16:00:00-03:00' }) });
    const titular = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const fila = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' } });
    await requisitarJson(api.baseUrl, `/inscricoes/${titular.corpo.id}/cancelamento`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T18:05:00-03:00' }) });

    const registro = await requisitarJson(api.baseUrl, `/encontros/${atividade.corpo.encontros[0].id}/presencas`, { method: 'POST', headers: { 'X-Usuario': 'p-diego' }, body: JSON.stringify({ codigo: 'ABCDEF' }) });
    const leitura = await requisitarJson(api.baseUrl, `/inscricoes/${fila.corpo.id}`, { headers: { 'X-Usuario': 'p-diego' } });

    expect(registro).toMatchObject({ status: 403, corpo: { erro: 'NAO_INSCRITO' } });
    expect(leitura.corpo).toMatchObject({ status: 'expirada', convocadaAte: null });
  });

  it('retorna identificador e campos condicionais no formato do contrato', async () => {
    const atividade = await requisitarJson(api.baseUrl, '/atividades', { method: 'POST', body: JSON.stringify({ titulo: 'Formato', tipo: 'palestra', salaId: 'auditorio', vagas: 1, encontros: [{ inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' }] }) });
    await requisitarJson(api.baseUrl, '/_teste/relogio', { method: 'PUT', body: JSON.stringify({ agora: '2026-10-20T17:00:00-03:00' }) });
    const confirmada = await requisitarJson(api.baseUrl, `/atividades/${atividade.corpo.id}/inscricoes`, { method: 'POST', headers: { 'X-Usuario': 'p-carla' } });
    const lista = await requisitarJson(api.baseUrl, `/inscricoes?atividadeId=${atividade.corpo.id}`, { headers: { 'X-Usuario': 'org-ana' } });

    expect(confirmada.corpo.id).toMatch(/^ins_[0-9a-f]{8}$/);
    expect(confirmada.corpo.criadaEm).toBe('2026-10-20T17:00:00-03:00');
    expect(confirmada.corpo.posicaoNaEspera).toBeNull();
    expect(confirmada.corpo.convocadaAte).toBeNull();
    expect(lista.corpo[0]).toEqual(expect.objectContaining({ id: confirmada.corpo.id, status: 'confirmada' }));
  });
});
