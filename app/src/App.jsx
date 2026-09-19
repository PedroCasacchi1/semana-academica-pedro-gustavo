import { useEffect, useState } from 'react';
import { criarAtividade, listarAtividades, listarSalas, obterAtividade } from './api.js';

const DIAS = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'];

const formularioInicial = {
  titulo: '',
  tipo: 'palestra',
  salaId: '',
  vagas: 1,
  encontrosTexto: '2026-10-19T19:00:00-03:00,2026-10-19T21:00:00-03:00',
};

function formatarDataHora(valor) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(valor));
}

function parseEncontros(texto) {
  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const [inicio, fim] = linha.split(',').map((parte) => parte.trim());
      return { inicio, fim };
    });
}

export function App() {
  const [dia, setDia] = useState('');
  const [tipo, setTipo] = useState('');
  const [salas, setSalas] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  async function carregarGrade(filtros = { dia, tipo }) {
    setErro('');
    setCarregando(true);
    try {
      const [salasDaApi, atividadesDaApi] = await Promise.all([
        listarSalas(),
        listarAtividades(filtros),
      ]);
      setSalas(salasDaApi);
      setAtividades(atividadesDaApi);
      setFormulario((atual) => ({ ...atual, salaId: atual.salaId || salasDaApi[0]?.id || '' }));
      if (atividadesDaApi.length === 0) setAtividadeSelecionada(null);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarGrade();
  }, []);

  async function aplicarFiltros(evento) {
    evento.preventDefault();
    await carregarGrade({ dia, tipo });
  }

  async function selecionarAtividade(id) {
    setErro('');
    setMensagem('');
    try {
      setAtividadeSelecionada(await obterAtividade(id));
    } catch (falha) {
      setErro(falha.message);
    }
  }

  async function enviarFormulario(evento) {
    evento.preventDefault();
    setErro('');
    setMensagem('');

    try {
      const criada = await criarAtividade({
        titulo: formulario.titulo,
        tipo: formulario.tipo,
        salaId: formulario.salaId,
        vagas: Number(formulario.vagas),
        encontros: parseEncontros(formulario.encontrosTexto),
      });
      setMensagem(`Atividade criada: ${criada.titulo}`);
      setFormulario((atual) => ({ ...formularioInicial, salaId: atual.salaId }));
      await carregarGrade({ dia, tipo });
      setAtividadeSelecionada(criada);
    } catch (falha) {
      setErro(falha.message);
    }
  }

  return (
    <main className="pagina">
      <header>
        <p className="rotulo">Semana Academica 2026</p>
        <h1>Grade de atividades</h1>
      </header>

      {erro && <div role="alert" className="alerta">{erro}</div>}
      {mensagem && <p className="sucesso">{mensagem}</p>}

      <section className="painel">
        <div>
          <h2>Programacao por dia</h2>
          <form className="filtros" onSubmit={aplicarFiltros}>
            <label>
              Dia
              <select value={dia} onChange={(evento) => setDia(evento.target.value)}>
                <option value="">Todos</option>
                {DIAS.map((diaOpcao) => <option key={diaOpcao} value={diaOpcao}>{diaOpcao}</option>)}
              </select>
            </label>
            <label>
              Tipo
              <select value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
                <option value="">Todos</option>
                <option value="palestra">Palestra</option>
                <option value="minicurso">Minicurso</option>
              </select>
            </label>
            <button type="submit">Filtrar</button>
          </form>

          {carregando ? <p>Carregando grade...</p> : null}
          {!carregando && atividades.length === 0 ? <p>Nenhuma atividade encontrada.</p> : null}
          <ul className="lista-atividades">
            {atividades.map((atividade) => (
              <li key={atividade.id}>
                <button type="button" onClick={() => selecionarAtividade(atividade.id)}>
                  <strong>{atividade.titulo}</strong>
                  <span>{atividade.tipo} · {atividade.situacao}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <Detalhe atividade={atividadeSelecionada} salas={salas} />
      </section>

      <section className="cartao">
        <h2>Criar atividade</h2>
        <form className="formulario" onSubmit={enviarFormulario}>
          <label>
            Titulo
            <input value={formulario.titulo} onChange={(evento) => setFormulario({ ...formulario, titulo: evento.target.value })} required />
          </label>
          <label>
            Tipo
            <select value={formulario.tipo} onChange={(evento) => setFormulario({ ...formulario, tipo: evento.target.value })}>
              <option value="palestra">Palestra</option>
              <option value="minicurso">Minicurso</option>
            </select>
          </label>
          <label>
            Sala
            <select value={formulario.salaId} onChange={(evento) => setFormulario({ ...formulario, salaId: evento.target.value })} required>
              {salas.map((sala) => <option key={sala.id} value={sala.id}>{sala.nome} ({sala.capacidade})</option>)}
            </select>
          </label>
          <label>
            Vagas
            <input type="number" min="1" value={formulario.vagas} onChange={(evento) => setFormulario({ ...formulario, vagas: evento.target.value })} required />
          </label>
          <label className="campo-largo">
            Encontros, um por linha: inicio,fim
            <textarea rows="4" value={formulario.encontrosTexto} onChange={(evento) => setFormulario({ ...formulario, encontrosTexto: evento.target.value })} required />
          </label>
          <button type="submit">Criar atividade</button>
        </form>
      </section>
    </main>
  );
}

function Detalhe({ atividade, salas }) {
  if (!atividade) {
    return (
      <aside className="cartao">
        <h2>Detalhe</h2>
        <p>Selecione uma atividade para ver encontros, vagas e situacao.</p>
      </aside>
    );
  }

  const sala = salas.find((item) => item.id === atividade.salaId);

  return (
    <aside className="cartao">
      <h2>{atividade.titulo}</h2>
      <dl>
        <dt>Tipo</dt><dd>{atividade.tipo}</dd>
        <dt>Sala</dt><dd>{sala ? sala.nome : atividade.salaId}</dd>
        <dt>Situacao</dt><dd>{atividade.situacao}</dd>
        <dt>Vagas</dt><dd>{atividade.ocupadas} ocupadas, {atividade.vagasRestantes} restantes, {atividade.emEspera} em espera</dd>
        <dt>Carga horaria</dt><dd>{atividade.cargaHorariaMinutos} minutos</dd>
      </dl>
      <h3>Encontros</h3>
      <ol>
        {atividade.encontros.map((encontro) => (
          <li key={encontro.id || `${encontro.inicio}-${encontro.fim}`}>
            {formatarDataHora(encontro.inicio)} ate {formatarDataHora(encontro.fim)}
          </li>
        ))}
      </ol>
    </aside>
  );
}
