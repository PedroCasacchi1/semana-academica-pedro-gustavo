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
    headers: {
      'Content-Type': 'application/json',
      'X-Usuario': 'org-ana',
      ...opcoes.headers,
    },
    ...opcoes,
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

describe('M1 grade de atividades - fatia 1', () => {
  let api;

  beforeEach(async () => {
    api = await iniciarApi();
    await fetch(`${api.baseUrl}/_teste/reset`, { method: 'POST' });
  });

  afterEach(async () => {
    await api.fechar();
  });

  it('retorna as salas dos dados iniciais', async () => {
    const resposta = await requisitarJson(api.baseUrl, '/salas');

    expect(resposta.status).toBe(200);
    expect(resposta.corpo).toEqual([
      { id: 'auditorio', nome: 'Auditório Central', capacidade: 200 },
      { id: 'sala-101', nome: 'Sala 101', capacidade: 40 },
      { id: 'sala-102', nome: 'Sala 102', capacidade: 40 },
      { id: 'lab-3', nome: 'Laboratório 3', capacidade: 20 },
    ]);
  });

  it('retorna encontros ordenados e carga horaria calculada ignorando valor enviado', async () => {
    const resposta = await criarAtividade(api.baseUrl, {
      titulo: 'Oficina de APIs',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      cargaHorariaMinutos: 999,
      encontros: [
        { inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:30:00-03:00' },
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' },
      ],
    });

    expect(resposta.status).toBe(201);
    expect(resposta.corpo).toMatchObject({
      titulo: 'Oficina de APIs',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      cargaHorariaMinutos: 210,
      situacao: 'prevista',
      ocupadas: 0,
      vagasRestantes: 20,
      emEspera: 0,
    });
    expect(resposta.corpo.id).toMatch(/^atv_[0-9a-f]{8}$/);
    expect(resposta.corpo.encontros.map((encontro) => encontro.inicio)).toEqual([
      '2026-10-19T19:00:00-03:00',
      '2026-10-20T19:00:00-03:00',
    ]);
    expect(resposta.corpo.encontros.map((encontro) => encontro.id)).toEqual([
      expect.stringMatching(/^enc_[0-9a-f]{8}$/),
      expect.stringMatching(/^enc_[0-9a-f]{8}$/),
    ]);

    const leitura = await requisitarJson(api.baseUrl, `/atividades/${resposta.corpo.id}`);

    expect(leitura.status).toBe(200);
    expect(leitura.corpo).toEqual(resposta.corpo);
  });

  it('lista atividades ordenadas por primeiro encontro e titulo mantendo canceladas', async () => {
    const atividade10h = await criarAtividade(api.baseUrl, {
      titulo: 'Zoologia aplicada',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T11:00:00-03:00' }],
    });
    const atividadeB = await criarAtividade(api.baseUrl, {
      titulo: 'Banco de dados',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 40,
      encontros: [{ inicio: '2026-10-19T09:00:00-03:00', fim: '2026-10-19T10:00:00-03:00' }],
    });
    const atividadeA = await criarAtividade(api.baseUrl, {
      titulo: 'Algoritmos',
      tipo: 'palestra',
      salaId: 'sala-102',
      vagas: 40,
      encontros: [{ inicio: '2026-10-19T09:00:00-03:00', fim: '2026-10-19T10:00:00-03:00' }],
    });

    await requisitarJson(api.baseUrl, `/atividades/${atividadeB.corpo.id}/cancelamento`, { method: 'POST' });

    const listagem = await requisitarJson(api.baseUrl, '/atividades');

    expect(listagem.status).toBe(200);
    expect(listagem.corpo.map((atividade) => atividade.id)).toEqual([
      atividadeA.corpo.id,
      atividadeB.corpo.id,
      atividade10h.corpo.id,
    ]);
    expect(listagem.corpo.find((atividade) => atividade.id === atividadeB.corpo.id).situacao).toBe('cancelada');
  });

  it('filtra atividades por dia em Brasilia combinado com tipo', async () => {
    const minicursoNoDia = await criarAtividade(api.baseUrl, {
      titulo: 'Minicurso no dia filtrado',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T21:00:00-03:00' },
        { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T21:00:00-03:00' },
      ],
    });
    await criarAtividade(api.baseUrl, {
      titulo: 'Palestra no mesmo dia',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' }],
    });
    await criarAtividade(api.baseUrl, {
      titulo: 'Minicurso em outro dia',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 40,
      encontros: [
        { inicio: '2026-10-22T19:00:00-03:00', fim: '2026-10-22T21:00:00-03:00' },
        { inicio: '2026-10-23T19:00:00-03:00', fim: '2026-10-23T21:00:00-03:00' },
      ],
    });

    const listagem = await requisitarJson(api.baseUrl, '/atividades?dia=2026-10-20&tipo=minicurso');

    expect(listagem.status).toBe(200);
    expect(listagem.corpo.map((atividade) => atividade.id)).toEqual([minicursoNoDia.corpo.id]);
  });
});
