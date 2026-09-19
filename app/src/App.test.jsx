import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.jsx';

const salas = [
  { id: 'auditorio', nome: 'Auditorio Central', capacidade: 200 },
  { id: 'lab-3', nome: 'Laboratorio 3', capacidade: 20 },
];

const atividades = [
  {
    id: 'atv_palestra',
    titulo: 'Abertura',
    tipo: 'palestra',
    salaId: 'auditorio',
    vagas: 200,
    encontros: [{ id: 'enc_1', inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' }],
    cargaHorariaMinutos: 120,
    situacao: 'prevista',
    ocupadas: 10,
    vagasRestantes: 190,
    emEspera: 0,
  },
  {
    id: 'atv_minicurso',
    titulo: 'React pratico',
    tipo: 'minicurso',
    salaId: 'lab-3',
    vagas: 20,
    encontros: [
      { id: 'enc_2', inicio: '2026-10-20T19:00:00-03:00', fim: '2026-10-20T21:00:00-03:00' },
      { id: 'enc_3', inicio: '2026-10-21T19:00:00-03:00', fim: '2026-10-21T21:00:00-03:00' },
    ],
    cargaHorariaMinutos: 240,
    situacao: 'prevista',
    ocupadas: 18,
    vagasRestantes: 2,
    emEspera: 3,
  },
];

const inscricoes = [
  {
    id: 'ins_espera01',
    atividadeId: 'atv_minicurso',
    participanteId: 'p-carla',
    status: 'em_espera',
    posicaoNaEspera: 2,
    convocadaAte: null,
    criadaEm: '2026-10-19T18:00:00-03:00',
  },
  {
    id: 'ins_convoc01',
    atividadeId: 'atv_minicurso',
    participanteId: 'p-carla',
    status: 'convocada',
    posicaoNaEspera: null,
    convocadaAte: '2099-10-19T20:00:00-03:00',
    criadaEm: '2026-10-19T17:00:00-03:00',
  },
];

let simularFalhaDeRede = false;

function respostaJson(corpo, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  });
}

function instalarFetchFake() {
  global.fetch = vi.fn((url, opcoes = {}) => {
    const endereco = new URL(url);
    if (endereco.pathname === '/salas') return respostaJson(salas);
    if (endereco.pathname === '/atividades' && opcoes.method === 'POST') {
      const corpo = JSON.parse(opcoes.body);
      if (corpo.vagas > 20 && corpo.salaId === 'lab-3') {
        return respostaJson({ erro: 'VAGAS_ACIMA_DA_CAPACIDADE', mensagem: 'Vagas excedem a sala' }, 422);
      }
      return respostaJson({ ...atividades[0], id: 'atv_nova', ...corpo, ocupadas: 0, vagasRestantes: corpo.vagas, emEspera: 0, cargaHorariaMinutos: 120, situacao: 'prevista' }, 201);
    }
    if (endereco.pathname === '/atividades') {
      const tipo = endereco.searchParams.get('tipo');
      return respostaJson(tipo ? atividades.filter((atividade) => atividade.tipo === tipo) : atividades);
    }
    if (endereco.pathname === '/atividades/atv_minicurso') return respostaJson(atividades[1]);
    if (endereco.pathname === '/atividades/atv_palestra') return respostaJson(atividades[0]);
    if (endereco.pathname === '/atividades/atv_palestra/inscricoes' && opcoes.method === 'POST') return respostaJson({ ...inscricoes[0], id: 'ins_nova01', atividadeId: 'atv_palestra', status: 'confirmada', posicaoNaEspera: null }, 201);
    if (endereco.pathname === '/inscricoes' && !opcoes.method) return respostaJson(inscricoes);
    if (endereco.pathname === '/inscricoes/ins_espera01/cancelamento') {
      return respostaJson({ ...inscricoes[0], status: 'cancelada', posicaoNaEspera: null });
    }
    if (endereco.pathname === '/inscricoes/ins_convoc01/confirmacao') {
      return respostaJson({ ...inscricoes[1], status: 'confirmada', convocadaAte: null });
    }
    if (endereco.pathname === '/encontros/enc_1/codigo') {
      return respostaJson({
        encontroId: 'enc_1',
        codigo: 'K7M2QX',
        trocaEm: '2026-10-19T19:01:00-03:00',
        validoAte: '2026-10-19T19:02:00-03:00',
      });
    }
    if (endereco.pathname === '/encontros/enc_1/presencas' && opcoes.method === 'POST') {
      if (simularFalhaDeRede) return Promise.reject(new TypeError('Failed to fetch'));
      return respostaJson({ id: 'pre_1', encontroId: 'enc_1', participanteId: 'p-carla', origem: 'qr_offline', lidoEm: '2026-10-19T19:00:00.000Z', registradaEm: '2026-10-19T19:00:01.000Z', justificativa: null }, 201);
    }
    if (endereco.pathname === '/encontros/enc_1/presencas') {
      return respostaJson([{ id: 'pre_1', encontroId: 'enc_1', participanteId: 'p-carla', origem: 'qr', lidoEm: '2026-10-19T19:00:00.000Z', registradaEm: '2026-10-19T19:00:01.000Z', justificativa: null }]);
    }
    return respostaJson({ erro: 'NAO_ENCONTRADO', mensagem: 'Nao encontrado' }, 404);
  });
}

beforeEach(() => {
  localStorage.clear();
  simularFalhaDeRede = false;
  instalarFetchFake();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App M1', () => {
  it('lista a programacao e aplica filtro por tipo sem usar API real', async () => {
    const usuario = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('button', { name: /Abertura/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /React pratico/ })).toBeInTheDocument();

    await usuario.selectOptions(screen.getAllByLabelText('Tipo')[0], 'minicurso');
    await usuario.click(screen.getByRole('button', { name: 'Filtrar' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /Abertura/ })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /React pratico/ })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/atividades?tipo=minicurso', expect.any(Object));
  });

  it('mostra detalhe com encontros, vagas e situacao', async () => {
    const usuario = userEvent.setup();
    render(<App />);

    await usuario.click(await screen.findByRole('button', { name: /React pratico/ }));

    const detalhe = screen.getByRole('heading', { name: 'React pratico' }).closest('aside');
    expect(within(detalhe).getByText('prevista')).toBeInTheDocument();
    expect(within(detalhe).getByText('18 ocupadas, 2 restantes, 3 em espera')).toBeInTheDocument();
    expect(within(detalhe).getByText(/20\/10\/2026/)).toBeInTheDocument();
    expect(within(detalhe).getByText(/21\/10\/2026/)).toBeInTheDocument();
  });

  it('cria atividade como organizacao e mostra erros retornados pela API', async () => {
    const usuario = userEvent.setup();
    render(<App />);

    await screen.findAllByRole('button', { name: /Abertura/ });
    await usuario.type(screen.getByLabelText('Titulo'), 'Oficina de testes');
    await usuario.selectOptions(screen.getAllByLabelText('Tipo')[1], 'minicurso');
    await usuario.selectOptions(screen.getByLabelText('Sala'), 'lab-3');
    await usuario.clear(screen.getByLabelText('Vagas'));
    await usuario.type(screen.getByLabelText('Vagas'), '21');
    await usuario.click(screen.getByRole('button', { name: 'Criar atividade' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('VAGAS_ACIMA_DA_CAPACIDADE');

    await usuario.clear(screen.getByLabelText('Vagas'));
    await usuario.type(screen.getByLabelText('Vagas'), '20');
    await usuario.click(screen.getByRole('button', { name: 'Criar atividade' }));

    expect(await screen.findByText('Atividade criada: Oficina de testes')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/atividades', expect.objectContaining({
      method: 'POST',
      usuario: 'org-ana',
    }));
  });
});

describe('M3 presenca por QR', () => {
  it('mostra o codigo do encontro para a organizacao', async () => {
    const usuario = userEvent.setup();
    render(<App />);

    await usuario.click(await screen.findByRole('button', { name: 'Código QR' }));

    expect(await screen.findByRole('heading', { name: 'Código do encontro' })).toBeInTheDocument();
    expect(screen.getByText('K7M2QX')).toBeInTheDocument();
  });

  it('guarda leitura com lidoEm no localStorage quando a rede falha', async () => {
    const usuario = userEvent.setup();
    simularFalhaDeRede = true;
    render(<App />);

    await usuario.click(await screen.findByRole('button', { name: 'Registrar presenca' }));
    await usuario.type(await screen.findByLabelText('Codigo QR'), 'K7M2QX');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar presenca' }));

    expect(await screen.findByText(/Leitura guardada/)).toBeInTheDocument();
    const fila = JSON.parse(localStorage.getItem('m3-presencas-offline'));
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ encontroId: 'enc_1', codigo: 'K7M2QX' });
    expect(fila[0].lidoEm).toMatch(/T/);
  });

  it('reenvia a fila offline quando a conexao volta', async () => {
    const usuario = userEvent.setup();
    simularFalhaDeRede = true;
    render(<App />);

    await usuario.click(await screen.findByRole('button', { name: 'Registrar presenca' }));
    await usuario.type(await screen.findByLabelText('Codigo QR'), 'K7M2QX');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar presenca' }));
    await screen.findByText(/Leitura guardada/);
    const leitura = JSON.parse(localStorage.getItem('m3-presencas-offline'))[0];

    simularFalhaDeRede = false;
    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(localStorage.getItem('m3-presencas-offline')).toBe('[]'));
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/encontros/enc_1/presencas', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ codigo: 'K7M2QX', lidoEm: leitura.lidoEm }),
    }));
  });

  it('lista presencas do encontro para a organizacao', async () => {
    const usuario = userEvent.setup();
    render(<App />);

    await usuario.click(await screen.findByRole('button', { name: 'Lista de presencas' }));

    expect(await screen.findByRole('heading', { name: 'Presencas registradas' })).toBeInTheDocument();
    expect(screen.getByText('p-carla')).toBeInTheDocument();
    expect(screen.getByText('qr')).toBeInTheDocument();
  });
});

describe('M2 inscricoes', () => {
  it('permite inscrever no detalhe da atividade', async () => {
    const usuario = userEvent.setup();
    render(<App />);

    await usuario.click(await screen.findByRole('button', { name: /Abertura/ }));
    await usuario.click(screen.getByRole('button', { name: 'Inscrever-se' }));

    expect(await screen.findByText('Inscricao realizada.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/atividades/atv_palestra/inscricoes', expect.objectContaining({ method: 'POST' }));
  });

  it('permite cancelar uma inscricao no detalhe da atividade', async () => {
    const usuario = userEvent.setup();
    render(<App />);

    await usuario.click(await screen.findByRole('button', { name: /React pratico/ }));
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar inscricao' }));

    expect(await screen.findByText('Inscricao cancelada.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/inscricoes/ins_espera01/cancelamento', expect.objectContaining({ method: 'POST' }));
  });

  it('lista status, espera, convocacao com contagem regressiva e confirma', async () => {
    const usuario = userEvent.setup();
    render(<App />);

    await usuario.click(await screen.findByRole('button', { name: 'Minhas inscricoes' }));

    expect(await screen.findByText(/Posicao na espera: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Tempo para confirmar:/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Confirmar convocacao' }));
    expect(await screen.findByText(/Inscricao confirmada/)).toBeInTheDocument();
  });

  it('cancela inscricao em minhas inscricoes', async () => {
    const usuario = userEvent.setup();
    render(<App />);

    await usuario.click(await screen.findByRole('button', { name: 'Minhas inscricoes' }));
    await usuario.click(screen.getAllByRole('button', { name: 'Cancelar inscricao' })[0]);

    expect(await screen.findByText(/Inscricao cancelada/)).toBeInTheDocument();
  });
});
