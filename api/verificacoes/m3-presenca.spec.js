import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarServidor } from '../src/server.js';

async function iniciarApi() {
  const app = criarServidor({ modoTeste: true });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    baseUrl,
    async fechar() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

async function requisitarJson(baseUrl, caminho, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      'X-Usuario': 'org-ana',
      ...opcoes.headers,
    },
  });
  const texto = await resposta.text();
  return {
    status: resposta.status,
    corpo: texto ? JSON.parse(texto) : null,
  };
}

async function criarAtividade(baseUrl, dados) {
  return requisitarJson(baseUrl, '/atividades', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

async function inscrever(baseUrl, atividadeId, participanteId) {
  return requisitarJson(baseUrl, `/atividades/${atividadeId}/inscricoes`, {
    method: 'POST',
    headers: { 'X-Usuario': participanteId },
  });
}

async function inscreverTodos(baseUrl, atividadeId, participantes) {
  const inscricoes = [];
  for (const participanteId of participantes) {
    inscricoes.push(await inscrever(baseUrl, atividadeId, participanteId));
  }
  return inscricoes;
}

describe('M3 presenca por QR - fatia 1', () => {
  let api;

  beforeEach(async () => {
    api = await iniciarApi();
    await fetch(`${api.baseUrl}/_teste/reset`, { method: 'POST' });
  });

  afterEach(async () => {
    await api.fechar();
  });

  it('fornece o codigo QR dentro da janela de 15 minutos antes do inicio', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Abertura com QR',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });

    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T09:45:00-03:00' }),
    });
    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`);

    expect(resposta.status).toBe(200);
    expect(resposta.corpo.encontroId).toBe(criada.corpo.encontros[0].id);
    expect(resposta.corpo.codigo).toMatch(/^[A-Z2-9]{6}$/);
    expect(resposta.corpo.trocaEm).toBe('2026-10-20T12:46:00.000Z');
    expect(resposta.corpo.validoAte).toBe('2026-10-20T12:47:00.000Z');
  });

  it('mantem o mesmo codigo em chamadas repetidas no mesmo minuto', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Codigo estavel',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });

    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T09:45:20-03:00' }),
    });
    const caminho = `/encontros/${criada.corpo.encontros[0].id}/codigo`;
    const primeira = await requisitarJson(api.baseUrl, caminho);
    const segunda = await requisitarJson(api.baseUrl, caminho);

    expect(primeira.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(segunda.corpo.codigo).toBe(primeira.corpo.codigo);
  });

  it('registra a primeira presenca QR de participante confirmado', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Presenca confirmada',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscreverTodos(api.baseUrl, criada.corpo.id, ['p-carla', 'p-diego']);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const codigo = await requisitarJson(
      api.baseUrl,
      `/encontros/${criada.corpo.encontros[0].id}/codigo`,
    );
    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo }),
    });

    expect(resposta.status).toBe(201);
    expect(resposta.corpo).toMatchObject({
      encontroId: criada.corpo.encontros[0].id,
      participanteId: 'p-carla',
      origem: 'qr',
      justificativa: null,
    });
    expect(resposta.corpo.id).toMatch(/^pre_[0-9a-f]{8}$/);
  });

  it('recusa codigo de encontro de atividade cancelada', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Atividade cancelada',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await requisitarJson(api.baseUrl, `/atividades/${criada.corpo.id}/cancelamento`, { method: 'POST' });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`);

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('ATIVIDADE_CANCELADA');
  });

  it('retorna a presenca original antes de validar um reenvio QR', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Presenca idempotente',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscreverTodos(api.baseUrl, criada.corpo.id, ['p-carla', 'p-diego']);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`);
    const caminho = `/encontros/${criada.corpo.encontros[0].id}/presencas`;
    const primeira = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo }),
    });
    const segunda = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: 'ZZZZZZ' }),
    });

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(200);
    expect(segunda.corpo).toEqual(primeira.corpo);
  });

  it('recusa participante convocado como nao inscrito para presenca', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Presenca convocada',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    const inscricao = await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, `/inscricoes/${inscricao.corpo.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const fila = await inscrever(api.baseUrl, criada.corpo.id, 'p-diego');
    await requisitarJson(api.baseUrl, `/inscricoes/${fila.corpo.id}/confirmacao`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`);
    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo }),
    });

    expect(resposta.status).toBe(403);
    expect(resposta.corpo.erro).toBe('NAO_INSCRITO');
  });

  it('valida justificativa manual antes de inscricao e janela', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Presenca manual',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T14:01:00-03:00' }),
    });

    const resposta = await requisitarJson(
      api.baseUrl,
      `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`,
      {
        method: 'POST',
        body: JSON.stringify({ participanteId: 'p-carla' }),
      },
    );

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('JUSTIFICATIVA_OBRIGATORIA');
  });

  it('aceita o codigo do minuto anterior e recusa codigo mais antigo', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Rotacao de codigo',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscreverTodos(api.baseUrl, criada.corpo.id, ['p-carla', 'p-diego']);
    const encontroId = criada.corpo.encontros[0].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:30-03:00' }),
    });
    const minutoAtual = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:01:00-03:00' }),
    });
    const minutoSeguinte = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);
    const anterior = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: minutoAtual.corpo.codigo }),
    });

    expect(minutoSeguinte.corpo.codigo).not.toBe(minutoAtual.corpo.codigo);
    expect(anterior.status).toBe(201);

    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:02:00-03:00' }),
    });
    const antigo = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
      body: JSON.stringify({ codigo: minutoAtual.corpo.codigo }),
    });

    expect(antigo.status).toBe(422);
    expect(antigo.corpo.erro).toBe('CODIGO_INVALIDO');
  });

  it('aceita codigo QR com minusculas e espacos na leitura', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Normalizacao de QR',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`);
    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: ` ${codigo.corpo.codigo.toLowerCase()} ` }),
    });

    expect(resposta.status).toBe(201);
  });

  it('mantem unicidade de presenca ao cruzar QR e manual', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Origens cruzadas',
      tipo: 'minicurso',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [
        { inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' },
        { inicio: '2026-10-21T10:00:00-03:00', fim: '2026-10-21T11:00:00-03:00' },
      ],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    const primeiro = criada.corpo.encontros[0].id;
    const segundo = criada.corpo.encontros[1].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const codigoPrimeiro = await requisitarJson(api.baseUrl, `/encontros/${primeiro}/codigo`);
    const qr = await requisitarJson(api.baseUrl, `/encontros/${primeiro}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigoPrimeiro.corpo.codigo }),
    });
    const manualDepois = await requisitarJson(api.baseUrl, `/encontros/${primeiro}/presencas/manual`, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Registro manual valido' }),
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-21T10:00:00-03:00' }),
    });
    const manual = await requisitarJson(api.baseUrl, `/encontros/${segundo}/presencas/manual`, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Registro manual valido' }),
    });
    const codigoSegundo = await requisitarJson(api.baseUrl, `/encontros/${segundo}/codigo`);
    const qrDepois = await requisitarJson(api.baseUrl, `/encontros/${segundo}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigoSegundo.corpo.codigo }),
    });

    expect(qr.status).toBe(201);
    expect(manualDepois.status).toBe(200);
    expect(manualDepois.corpo).toEqual(qr.corpo);
    expect(manual.status).toBe(201);
    expect(qrDepois.status).toBe(200);
    expect(qrDepois.corpo).toEqual(manual.corpo);
  });

  it('registra os instantes da presenca usando o relogio controlado', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Relogio controlado',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:05:07-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`);
    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo }),
    });

    expect(resposta.corpo.lidoEm).toBe('2026-10-20T10:05:07-03:00');
    expect(resposta.corpo.registradaEm).toBe('2026-10-20T10:05:07-03:00');
  });

  it('recusa rota M3 sem identificacao do usuario', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Identificacao M3',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    const respostaHttp = await fetch(`${api.baseUrl}/encontros/${criada.corpo.encontros[0].id}/codigo`);
    const corpo = await respostaHttp.json();

    expect(respostaHttp.status).toBe(401);
    expect(corpo.erro).toBe('USUARIO_DESCONHECIDO');
  });

  it('recusa obter codigo um segundo antes da abertura da janela QR', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Janela antes da abertura',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T09:44:59-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`);

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('FORA_DA_JANELA');
  });

  it('aceita obter codigo exatamente na abertura da janela QR', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Janela no limite inicial',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T09:45:00-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`);

    expect(resposta.status).toBe(200);
  });

  it('aceita obter codigo exatamente no fim da janela QR', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Janela no limite final',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:30:00-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`);

    expect(resposta.status).toBe(200);
  });

  it('recusa obter codigo um segundo depois do fim da janela QR', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Janela depois do fim',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:30:01-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`);

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('FORA_DA_JANELA');
  });

  it('recusa registrar presenca QR fora da janela', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Registro fora da janela',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    const encontroId = criada.corpo.encontros[0].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:30:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:30:01-03:00' }),
    });
    const resposta = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo }),
    });

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('FORA_DA_JANELA');
  });

  it('recusa participante ao obter codigo QR', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Perfil no codigo',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`, {
      headers: { 'X-Usuario': 'p-carla' },
    });

    expect(resposta.status).toBe(403);
    expect(resposta.corpo.erro).toBe('SOMENTE_ORGANIZACAO');
  });

  it('recusa organizacao ao registrar presenca QR', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Perfil na presenca',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/presencas`, {
      method: 'POST',
      body: JSON.stringify({ codigo: 'ABC234' }),
    });

    expect(resposta.status).toBe(403);
    expect(resposta.corpo.erro).toBe('SOMENTE_PARTICIPANTE');
  });

  it('gera codigo QR de seis caracteres no alfabeto contratado', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Alfabeto do codigo',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`);
    const codigo = resposta.corpo.codigo;

    expect(codigo).toHaveLength(6);
    expect(codigo).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('aceita registrar presenca QR exatamente na abertura da janela', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Presenca no limite inicial',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T09:45:00-03:00' }),
    });
    const encontroId = criada.corpo.encontros[0].id;
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);
    const resposta = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo }),
    });

    expect(resposta.status).toBe(201);
  });

  it('aceita registrar presenca QR exatamente no fim da janela', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Presenca no limite final',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:30:00-03:00' }),
    });
    const encontroId = criada.corpo.encontros[0].id;
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);
    const resposta = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo }),
    });

    expect(resposta.status).toBe(201);
  });

  it('aceita leitura offline dentro da janela enviada antes do limite de sincronizacao', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Offline dentro do prazo',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    const encontroId = criada.corpo.encontros[0].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:15:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T12:30:00-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo, lidoEm: '2026-10-20T10:15:00-03:00' }),
    });

    expect(resposta.status).toBe(201);
    expect(resposta.corpo).toMatchObject({
      encontroId,
      participanteId: 'p-carla',
      origem: 'qr_offline',
      lidoEm: '2026-10-20T10:15:00-03:00',
      registradaEm: '2026-10-20T12:30:00-03:00',
    });
  });

  it('recusa leitura offline sincronizada depois de fim mais duas horas', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Offline tarde demais',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    const encontroId = criada.corpo.encontros[0].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:15:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T13:00:01-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo, lidoEm: '2026-10-20T10:15:00-03:00' }),
    });

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('SINCRONIZACAO_TARDIA');
  });

  it('recusa lidoEm fora da janela mesmo com envio dentro dela', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Leitura fora da janela',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    const encontroId = criada.corpo.encontros[0].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T09:45:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo, lidoEm: '2026-10-20T09:44:59-03:00' }),
    });

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('FORA_DA_JANELA');
  });

  it('descarta lidoEm posterior ao envio e preserva origem offline', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Relogio offline adiantado',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    const encontroId = criada.corpo.encontros[0].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo, lidoEm: '2026-10-20T10:05:00-03:00' }),
    });

    expect(resposta.status).toBe(201);
    expect(resposta.corpo).toMatchObject({
      origem: 'qr_offline',
      lidoEm: '2026-10-20T10:00:00-03:00',
      registradaEm: '2026-10-20T10:00:00-03:00',
    });
  });

  it('confere codigo offline no instante de lidoEm e nao no envio', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Codigo no instante da leitura',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    const encontroId = criada.corpo.encontros[0].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:02:00-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo, lidoEm: '2026-10-20T10:00:00-03:00' }),
    });

    expect(resposta.status).toBe(201);
    expect(resposta.corpo.origem).toBe('qr_offline');
  });

  it('aceita leitura offline enviada exatamente em fim mais duas horas', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Offline no limite tardio',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    const encontroId = criada.corpo.encontros[0].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:15:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T13:00:00-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo, lidoEm: '2026-10-20T10:15:00-03:00' }),
    });

    expect(resposta.status).toBe(201);
    expect(resposta.corpo.origem).toBe('qr_offline');
  });

  it('aceita presenca manual exatamente 15 minutos antes do inicio', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Manual no limite inicial',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T09:45:00-03:00' }),
    });

    const resposta = await requisitarJson(
      api.baseUrl,
      `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`,
      {
        method: 'POST',
        body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Justificativa valida' }),
      },
    );

    expect(resposta.status).toBe(201);
    expect(resposta.corpo.origem).toBe('manual');
  });

  it('aceita presenca manual exatamente em fim mais duas horas', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Manual no limite tardio',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T13:00:00-03:00' }),
    });

    const resposta = await requisitarJson(
      api.baseUrl,
      `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`,
      {
        method: 'POST',
        body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Justificativa valida' }),
      },
    );

    expect(resposta.status).toBe(201);
  });

  it('recusa presenca manual um segundo depois de fim mais duas horas', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Manual depois do limite tardio',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T13:00:01-03:00' }),
    });

    const resposta = await requisitarJson(
      api.baseUrl,
      `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`,
      {
        method: 'POST',
        body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Justificativa valida' }),
      },
    );

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('FORA_DA_JANELA');
  });

  it('recusa justificativa manual com nove caracteres uteis', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Justificativa curta',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resposta = await requisitarJson(
      api.baseUrl,
      `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`,
      {
        method: 'POST',
        body: JSON.stringify({ participanteId: 'p-carla', justificativa: '123456789' }),
      },
    );

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('JUSTIFICATIVA_OBRIGATORIA');
  });

  it('aceita justificativa manual com dez caracteres uteis', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Justificativa no limite',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resposta = await requisitarJson(
      api.baseUrl,
      `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`,
      {
        method: 'POST',
        body: JSON.stringify({ participanteId: 'p-carla', justificativa: '1234567890' }),
      },
    );

    expect(resposta.status).toBe(201);
  });

  it('recusa justificativa manual composta apenas por espacos', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Justificativa em branco',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resposta = await requisitarJson(
      api.baseUrl,
      `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`,
      {
        method: 'POST',
        body: JSON.stringify({ participanteId: 'p-carla', justificativa: '          ' }),
      },
    );

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('JUSTIFICATIVA_OBRIGATORIA');
  });

  it('retorna justificativa manual exatamente como enviada', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Justificativa preservada',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const justificativa = '  Motivo URGENTE\nCom segunda linha  ';

    const resposta = await requisitarJson(
      api.baseUrl,
      `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`,
      {
        method: 'POST',
        body: JSON.stringify({ participanteId: 'p-carla', justificativa }),
      },
    );

    expect(resposta.status).toBe(201);
    expect(resposta.corpo.justificativa).toBe(justificativa);
  });

  it('valida justificativa antes de verificar duplicidade manual', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Ordem justificativa duplicada',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const caminho = `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`;
    const primeira = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Primeiro registro' }),
    });
    const segunda = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla' }),
    });

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(422);
    expect(segunda.corpo.erro).toBe('JUSTIFICATIVA_OBRIGATORIA');
  });

  it('limita presencas manuais de cinco confirmados a uma', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Limite de manuais para cinco',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscreverTodos(api.baseUrl, criada.corpo.id, [
      'p-carla', 'p-diego', 'p-elisa', 'p-fabio', 'p-gabriela',
    ]);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const caminho = `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`;
    const primeira = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Primeira manual' }),
    });
    const segunda = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-diego', justificativa: 'Segunda manual' }),
    });
    const terceira = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-elisa', justificativa: 'Terceira manual' }),
    });

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(422);
    expect(segunda.corpo.erro).toBe('LIMITE_DE_MANUAIS');
    expect(terceira.status).toBe(422);
    expect(terceira.corpo.erro).toBe('LIMITE_DE_MANUAIS');
  });

  it('arredonda para cima o limite de manuais de cinco confirmados', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Limite de manuais para cinco arredondado',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscreverTodos(api.baseUrl, criada.corpo.id, [
      'p-carla', 'p-diego', 'p-elisa', 'p-fabio', 'p-gabriela',
    ]);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const caminho = `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`;
    const respostas = [];
    for (const participanteId of ['p-carla', 'p-diego', 'p-elisa', 'p-fabio']) {
      respostas.push(await requisitarJson(api.baseUrl, caminho, {
        method: 'POST',
        body: JSON.stringify({ participanteId, justificativa: 'Manual valida' }),
      }));
    }

    expect(respostas[0].status).toBe(201);
    expect(respostas.slice(1).every((resposta) => resposta.status === 422)).toBe(true);
    expect(respostas.slice(1).every((resposta) => resposta.corpo.erro === 'LIMITE_DE_MANUAIS')).toBe(true);
  });

  it('permite uma presenca manual para cinco confirmados', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Limite de manuais para 5',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscreverTodos(api.baseUrl, criada.corpo.id, ['p-carla', 'p-diego', 'p-elisa', 'p-fabio', 'p-gabriela']);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resposta = await requisitarJson(
      api.baseUrl,
      `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`,
      {
        method: 'POST',
        body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Manual valida' }),
      },
    );

    expect(resposta.status).toBe(201);
  });

  it('presenca manual duplicada nao consome o limite', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Duplicidade sem consumo',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscreverTodos(api.baseUrl, criada.corpo.id, ['p-carla', 'p-diego', 'p-elisa', 'p-fabio', 'p-gabriela']);
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const caminho = `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`;
    const primeira = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Manual valida' }),
    });
    const duplicada = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Outra justificativa' }),
    });
    const outra = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-diego', justificativa: 'Outra manual' }),
    });

    expect(primeira.status).toBe(201);
    expect(duplicada.status).toBe(200);
    expect(duplicada.corpo).toEqual(primeira.corpo);
    expect(outra.status).toBe(422);
    expect(outra.corpo.erro).toBe('LIMITE_DE_MANUAIS');
  });

  it('verifica duplicidade manual antes de nao inscrito', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Duplicidade antes de inscricao',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T09:45:00-03:00' }),
    });
    const encontroId = criada.corpo.encontros[0].id;
    const caminho = `/encontros/${encontroId}/presencas/manual`;
    const primeira = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Manual valida' }),
    });
    await requisitarJson(api.baseUrl, `/atividades/${criada.corpo.id}/cancelamento`, { method: 'POST' });
    const duplicada = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Outra manual' }),
    });

    expect(primeira.status).toBe(201);
    expect(duplicada.status).toBe(200);
    expect(duplicada.corpo).toEqual(primeira.corpo);
  });

  it('recusa corpo QR invalido antes da janela do recurso', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Corpo QR invalido',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:30:01-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({}),
    });

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('DADOS_INVALIDOS');
  });

  it('recusa corpo manual sem participanteId', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Corpo manual invalido',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resposta = await requisitarJson(
      api.baseUrl,
      `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`,
      {
        method: 'POST',
        body: JSON.stringify({ justificativa: 'Manual valida' }),
      },
    );

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('DADOS_INVALIDOS');
  });

  it('recusa codigo de um encontro usado em outro encontro', async () => {
    const primeira = await criarAtividade(api.baseUrl, {
      titulo: 'Codigo origem',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 40,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    const segunda = await criarAtividade(api.baseUrl, {
      titulo: 'Codigo destino',
      tipo: 'palestra',
      salaId: 'sala-102',
      vagas: 40,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, segunda.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${primeira.corpo.encontros[0].id}/codigo`);
    const resposta = await requisitarJson(api.baseUrl, `/encontros/${segunda.corpo.encontros[0].id}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo }),
    });

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('CODIGO_INVALIDO');
  });

  it('retorna a mesma presenca em reenvio QR offline', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Duplicidade offline',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    const encontroId = criada.corpo.encontros[0].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:15:00-03:00' }),
    });
    const codigo = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/codigo`);
    const caminho = `/encontros/${encontroId}/presencas`;
    const primeira = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: codigo.corpo.codigo, lidoEm: '2026-10-20T10:15:00-03:00' }),
    });
    const segunda = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: 'ZZZZZZ', lidoEm: '2026-10-20T10:16:00-03:00' }),
    });

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(200);
    expect(segunda.corpo).toEqual(primeira.corpo);
  });

  it('prioriza nao inscrito antes de codigo invalido no QR', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Ordem QR nao inscrito',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: 'ZZZZZZ' }),
    });

    expect(resposta.status).toBe(403);
    expect(resposta.corpo.erro).toBe('NAO_INSCRITO');
  });

  it('recusa todos os status de inscricao nao confirmada', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Status nao elegiveis',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 1,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    const carla = await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    const diego = await inscrever(api.baseUrl, criada.corpo.id, 'p-diego');
    await requisitarJson(api.baseUrl, `/inscricoes/${carla.corpo.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const elisa = await inscrever(api.baseUrl, criada.corpo.id, 'p-elisa');
    const fabio = await inscrever(api.baseUrl, criada.corpo.id, 'p-fabio');
    for (const [inscricao, participanteId] of [[elisa, 'p-elisa'], [fabio, 'p-fabio']]) {
      await requisitarJson(api.baseUrl, `/inscricoes/${inscricao.corpo.id}/cancelamento`, {
        method: 'POST',
        headers: { 'X-Usuario': participanteId },
      });
    }
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const caminho = `/encontros/${criada.corpo.encontros[0].id}/presencas`;
    for (const participanteId of ['p-carla', 'p-diego', 'p-elisa', 'p-fabio']) {
      const resposta = await requisitarJson(api.baseUrl, caminho, {
        method: 'POST',
        headers: { 'X-Usuario': participanteId },
        body: JSON.stringify({ codigo: 'ZZZZZZ' }),
      });
      expect(resposta.status).toBe(403);
      expect(resposta.corpo.erro).toBe('NAO_INSCRITO');
    }
  });

  it('aplica limite de manuais separadamente por encontro', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Limite por encontro',
      tipo: 'minicurso',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [
        { inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' },
        { inicio: '2026-10-21T10:00:00-03:00', fim: '2026-10-21T11:00:00-03:00' },
      ],
    });
    await inscreverTodos(api.baseUrl, criada.corpo.id, ['p-carla', 'p-diego', 'p-elisa', 'p-fabio', 'p-gabriela']);
    const primeiro = criada.corpo.encontros[0].id;
    const segundo = criada.corpo.encontros[1].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const primeira = await requisitarJson(api.baseUrl, `/encontros/${primeiro}/presencas/manual`, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Primeiro encontro' }),
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-21T10:00:00-03:00' }),
    });
    const segunda = await requisitarJson(api.baseUrl, `/encontros/${segundo}/presencas/manual`, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Segundo encontro' }),
    });

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(201);
  });

  it('recusa usuario inexistente em rota M3', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Usuario inexistente',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/codigo`, {
      headers: { 'X-Usuario': 'usuario-inexistente' },
    });

    expect(resposta.status).toBe(401);
    expect(resposta.corpo.erro).toBe('USUARIO_DESCONHECIDO');
  });

  it('prioriza fora da janela antes do limite de manuais', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Ordem janela e limite',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscreverTodos(api.baseUrl, criada.corpo.id, ['p-carla', 'p-diego', 'p-elisa', 'p-fabio', 'p-gabriela']);
    const caminho = `/encontros/${criada.corpo.encontros[0].id}/presencas/manual`;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });
    const primeira = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-carla', justificativa: 'Primeira manual' }),
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T13:00:01-03:00' }),
    });
    const segunda = await requisitarJson(api.baseUrl, caminho, {
      method: 'POST',
      body: JSON.stringify({ participanteId: 'p-diego', justificativa: 'Segunda manual' }),
    });

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(422);
    expect(segunda.corpo.erro).toBe('FORA_DA_JANELA');
  });

  it('prioriza sincronizacao tardia antes de codigo invalido', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Ordem tardia e codigo',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    const encontroId = criada.corpo.encontros[0].id;
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T13:00:01-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: 'ZZZZZZ', lidoEm: '2026-10-20T10:15:00-03:00' }),
    });

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('SINCRONIZACAO_TARDIA');
  });

  it('prioriza fora da janela antes de codigo invalido no QR', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Ordem janela e codigo',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await inscrever(api.baseUrl, criada.corpo.id, 'p-carla');
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:30:01-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: 'ZZZZZZ' }),
    });

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('FORA_DA_JANELA');
  });

  it('valida corpo QR antes de verificar inscricao', async () => {
    const criada = await criarAtividade(api.baseUrl, {
      titulo: 'Corpo antes de inscricao',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await requisitarJson(api.baseUrl, '/_teste/relogio', {
      method: 'PUT',
      body: JSON.stringify({ agora: '2026-10-20T10:00:00-03:00' }),
    });

    const resposta = await requisitarJson(api.baseUrl, `/encontros/${criada.corpo.encontros[0].id}/presencas`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
      body: JSON.stringify({}),
    });

    expect(resposta.status).toBe(422);
    expect(resposta.corpo.erro).toBe('DADOS_INVALIDOS');
  });
});
