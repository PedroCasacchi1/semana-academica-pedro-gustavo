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

  it('cria palestra com um encontro e minicurso com dois encontros', async () => {
    const palestra = await criarAtividade(api.baseUrl, {
      titulo: 'Abertura',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 200,
      encontros: [{ inicio: '2026-10-19T09:00:00-03:00', fim: '2026-10-19T10:00:00-03:00' }],
    });
    const minicurso = await criarAtividade(api.baseUrl, {
      titulo: 'APIs com Node',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T21:00:00-03:00' },
        { inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T21:00:00-03:00' },
      ],
    });

    expect(palestra.status).toBe(201);
    expect(palestra.corpo).toMatchObject({
      titulo: 'Abertura',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 200,
      cargaHorariaMinutos: 60,
      situacao: 'prevista',
      ocupadas: 0,
      vagasRestantes: 200,
      emEspera: 0,
    });
    expect(palestra.corpo.id).toMatch(/^atv_[0-9a-f]{8}$/);
    expect(palestra.corpo.encontros[0].id).toMatch(/^enc_[0-9a-f]{8}$/);

    expect(minicurso.status).toBe(201);
    expect(minicurso.corpo.cargaHorariaMinutos).toBe(240);
  });

  it('recusa atividade com quantidade de encontros invalida para o tipo', async () => {
    const palestra = await criarAtividade(api.baseUrl, {
      titulo: 'Palestra com encontros demais',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 100,
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' },
        { inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T20:00:00-03:00' },
      ],
    });
    const minicursoComUm = await criarAtividade(api.baseUrl, {
      titulo: 'Minicurso curto demais',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [{ inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T20:00:00-03:00' }],
    });
    const minicursoComSeis = await criarAtividade(api.baseUrl, {
      titulo: 'Minicurso longo demais',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { inicio: '2026-10-19T08:00:00-03:00', fim: '2026-10-19T09:00:00-03:00' },
        { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T11:00:00-03:00' },
        { inicio: '2026-10-20T08:00:00-03:00', fim: '2026-10-20T09:00:00-03:00' },
        { inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T11:00:00-03:00' },
        { inicio: '2026-10-21T08:00:00-03:00', fim: '2026-10-21T09:00:00-03:00' },
        { inicio: '2026-10-21T10:00:00-03:00', fim: '2026-10-21T11:00:00-03:00' },
      ],
    });

    expect(palestra.status).toBe(422);
    expect(palestra.corpo.erro).toBe('QUANTIDADE_DE_ENCONTROS');
    expect(minicursoComUm.status).toBe(422);
    expect(minicursoComUm.corpo.erro).toBe('QUANTIDADE_DE_ENCONTROS');
    expect(minicursoComSeis.status).toBe(422);
    expect(minicursoComSeis.corpo.erro).toBe('QUANTIDADE_DE_ENCONTROS');
  });

  it('recusa encontros invalidos', async () => {
    const base = { titulo: 'Palestra invalida', tipo: 'palestra', salaId: 'auditorio', vagas: 100 };
    const casos = [
      [{ inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T19:59:00-03:00' }],
      [{ inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T23:01:00-03:00' }],
      [{ inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T19:00:00-03:00' }],
      [{ inicio: '2026-10-19T23:00:00-03:00', fim: '2026-10-20T00:00:00-03:00' }],
      [{ inicio: '2026-10-24T09:00:00-03:00', fim: '2026-10-24T10:00:00-03:00' }],
    ];

    for (const encontros of casos) {
      const resposta = await criarAtividade(api.baseUrl, { ...base, encontros });
      expect(resposta.status).toBe(422);
      expect(resposta.corpo.erro).toBe('ENCONTRO_INVALIDO');
    }

    const sobreposto = await criarAtividade(api.baseUrl, {
      titulo: 'Minicurso sobreposto',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [
        { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' },
        { inicio: '2026-10-19T20:30:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
      ],
    });
    expect(sobreposto.status).toBe(422);
    expect(sobreposto.corpo.erro).toBe('ENCONTRO_INVALIDO');
  });

  it('recusa vagas menores que um ou acima da capacidade da sala', async () => {
    const semVaga = await criarAtividade(api.baseUrl, {
      titulo: 'Sem vagas',
      tipo: 'palestra',
      salaId: 'lab-3',
      vagas: 0,
      encontros: [{ inicio: '2026-10-19T09:00:00-03:00', fim: '2026-10-19T10:00:00-03:00' }],
    });
    const acimaDaCapacidade = await criarAtividade(api.baseUrl, {
      titulo: 'Vagas demais',
      tipo: 'palestra',
      salaId: 'lab-3',
      vagas: 21,
      encontros: [{ inicio: '2026-10-19T11:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }],
    });

    expect(semVaga.status).toBe(422);
    expect(semVaga.corpo.erro).toBe('DADOS_INVALIDOS');
    expect(acimaDaCapacidade.status).toBe(422);
    expect(acimaDaCapacidade.corpo.erro).toBe('VAGAS_ACIMA_DA_CAPACIDADE');
  });

  it('recusa conflito de sala sem intervalo minimo de quinze minutos', async () => {
    await criarAtividade(api.baseUrl, {
      titulo: 'Primeira atividade',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 40,
      encontros: [{ inicio: '2026-10-19T09:00:00-03:00', fim: '2026-10-19T10:00:00-03:00' }],
    });

    const conflito = await criarAtividade(api.baseUrl, {
      titulo: 'Conflito',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 40,
      encontros: [{ inicio: '2026-10-19T10:14:00-03:00', fim: '2026-10-19T11:14:00-03:00' }],
    });
    const semConflito = await criarAtividade(api.baseUrl, {
      titulo: 'Sem conflito',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 40,
      encontros: [{ inicio: '2026-10-19T10:15:00-03:00', fim: '2026-10-19T11:15:00-03:00' }],
    });

    expect(conflito.status).toBe(409);
    expect(conflito.corpo.erro).toBe('CONFLITO_DE_SALA');
    expect(semConflito.status).toBe(201);
  });

  it('mantem atividades canceladas na listagem e ignora canceladas no conflito de sala', async () => {
    const cancelada = await criarAtividade(api.baseUrl, {
      titulo: 'Atividade cancelada',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 40,
      encontros: [{ inicio: '2026-10-19T09:00:00-03:00', fim: '2026-10-19T10:00:00-03:00' }],
    });
    await requisitarJson(api.baseUrl, `/atividades/${cancelada.corpo.id}/cancelamento`, { method: 'POST' });

    const mesmaSalaMesmoHorario = await criarAtividade(api.baseUrl, {
      titulo: 'Atividade liberada',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 40,
      encontros: [{ inicio: '2026-10-19T09:00:00-03:00', fim: '2026-10-19T10:00:00-03:00' }],
    });
    const listagem = await requisitarJson(api.baseUrl, '/atividades');

    expect(mesmaSalaMesmoHorario.status).toBe(201);
    expect(listagem.corpo.map((atividade) => atividade.id)).toContain(cancelada.corpo.id);
    expect(listagem.corpo.find((atividade) => atividade.id === cancelada.corpo.id).situacao).toBe('cancelada');
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
    expect(resposta.corpo.encontros.map((encontro) => encontro.inicio)).toEqual([
      '2026-10-19T19:00:00-03:00',
      '2026-10-20T19:00:00-03:00',
    ]);

    const leitura = await requisitarJson(api.baseUrl, `/atividades/${resposta.corpo.id}`);

    expect(leitura.status).toBe(200);
    expect(leitura.corpo).toEqual(resposta.corpo);
  });

  it('lista atividades ordenadas por primeiro encontro e titulo', async () => {
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

    const listagem = await requisitarJson(api.baseUrl, '/atividades');

    expect(listagem.status).toBe(200);
    expect(listagem.corpo.map((atividade) => atividade.id)).toEqual([
      atividadeA.corpo.id,
      atividadeB.corpo.id,
      atividade10h.corpo.id,
    ]);
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
