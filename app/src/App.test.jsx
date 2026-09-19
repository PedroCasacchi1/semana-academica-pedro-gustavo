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
    return respostaJson({ erro: 'NAO_ENCONTRADO', mensagem: 'Nao encontrado' }, 404);
  });
}

beforeEach(() => {
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
