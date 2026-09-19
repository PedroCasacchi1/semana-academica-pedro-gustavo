import { useEffect, useState } from 'react';
import {
  criarAtividade,
  listarAtividades,
  listarPresencas,
  listarSalas,
  obterAtividade,
  obterCodigoEncontro,
  registrarPresenca,
} from './api.js';

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
  const [modo, setModo] = useState('grade');
  const [dia, setDia] = useState('');
  const [tipo, setTipo] = useState('');
  const [salas, setSalas] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const encontros = atividades.flatMap((atividade) => atividade.encontros.map((encontro) => ({
    ...encontro,
    atividadeTitulo: atividade.titulo,
  })));

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
        <div className="cabecalho-linha">
          <h1>{modo === 'grade' ? 'Grade de atividades' : modo === 'codigo' ? 'Presenca ao vivo' : modo === 'registrar' ? 'Registrar presenca' : 'Presencas do encontro'}</h1>
          <span className="status-pill">M3 · Presenca</span>
        </div>
        <nav className="navegacao" aria-label="Modulos">
          <button type="button" className={modo === 'grade' ? 'ativo' : ''} onClick={() => setModo('grade')}>Grade</button>
          <button type="button" className={modo === 'codigo' ? 'ativo' : ''} onClick={() => setModo('codigo')}>Código QR</button>
          <button type="button" className={modo === 'registrar' ? 'ativo' : ''} onClick={() => setModo('registrar')}>Registrar presenca</button>
          <button type="button" className={modo === 'lista' ? 'ativo' : ''} onClick={() => setModo('lista')}>Lista de presencas</button>
        </nav>
      </header>

      {erro && <div role="alert" className="alerta">{erro}</div>}
      {mensagem && <p className="sucesso">{mensagem}</p>}

      {modo === 'codigo' && <TelaCodigo encontros={encontros} carregando={carregando} />}
      {modo === 'registrar' && <TelaRegistrar encontros={encontros} onErro={setErro} />}
      {modo === 'lista' && <TelaListaPresencas encontros={encontros} onErro={setErro} />}

      {modo === 'grade' && <>
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
      </>}
    </main>
  );
}

function SeletorEncontro({ encontros, value, onChange, label = 'Encontro' }) {
  return (
    <label className="seletor-encontro">
      {label}
      <select value={value} onChange={(evento) => onChange(evento.target.value)} disabled={!encontros.length}>
        <option value="">Selecione um encontro</option>
        {encontros.map((encontro) => (
          <option key={encontro.id} value={encontro.id}>
            {encontro.atividadeTitulo} · {formatarDataHora(encontro.inicio)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TelaCodigo({ encontros, carregando }) {
  const [encontroId, setEncontroId] = useState('');
  const [codigo, setCodigo] = useState(null);
  const [erroLocal, setErroLocal] = useState('');
  const encontroAtual = encontros.find((encontro) => encontro.id === encontroId);

  useEffect(() => {
    if (!encontroId && encontros[0]) setEncontroId(encontros[0].id);
  }, [encontros, encontroId]);

  useEffect(() => {
    let cancelado = false;
    let temporizador;

    async function buscar() {
      if (!encontroId) return;
      setErroLocal('');
      try {
        const novoCodigo = await obterCodigoEncontro(encontroId);
        if (cancelado) return;
        setCodigo(novoCodigo);
        const atraso = Math.min(2147483647, Math.max(250, Date.parse(novoCodigo.trocaEm) - Date.now()));
        temporizador = window.setTimeout(buscar, atraso);
      } catch (falha) {
        if (!cancelado) setErroLocal(falha.message);
      }
    }

    buscar();
    return () => {
      cancelado = true;
      window.clearTimeout(temporizador);
    };
  }, [encontroId]);

  return (
    <section className="codigo-tela">
      <div className="codigo-barra">
        <div>
          <p className="rotulo">Painel da organizacao</p>
          <h2>Código do encontro</h2>
        </div>
        <SeletorEncontro encontros={encontros} value={encontroId} onChange={setEncontroId} />
      </div>
      {carregando && <p>Carregando encontros...</p>}
      {erroLocal && <div role="alert" className="alerta">{erroLocal}</div>}
      {codigo && encontroAtual ? (
        <div className="codigo-hero" aria-live="polite">
          <span>{encontroAtual.atividadeTitulo}</span>
          <strong>{codigo.codigo}</strong>
          <p>Atualiza automaticamente às {formatarDataHora(codigo.trocaEm)}</p>
        </div>
      ) : <p className="estado-vazio">Escolha um encontro para exibir o código.</p>}
    </section>
  );
}

function TelaRegistrar({ encontros, onErro }) {
  const [encontroId, setEncontroId] = useState('');
  const [codigo, setCodigo] = useState('');
  const [mensagemLocal, setMensagemLocal] = useState('');
  const [pendentes, setPendentes] = useState(() => lerFilaPresencas());

  useEffect(() => {
    if (!encontroId && encontros[0]) setEncontroId(encontros[0].id);
  }, [encontros, encontroId]);

  useEffect(() => {
    async function reenviar() {
      const fila = lerFilaPresencas();
      const restantes = [];
      for (const leitura of fila) {
        try {
          await registrarPresenca(leitura.encontroId, { codigo: leitura.codigo, lidoEm: leitura.lidoEm });
        } catch (falha) {
          if (!falha.status) restantes.push(leitura);
        }
      }
      salvarFilaPresencas(restantes);
      setPendentes(restantes);
    }
    window.addEventListener('online', reenviar);
    reenviar();
    return () => window.removeEventListener('online', reenviar);
  }, []);

  async function enviar(evento) {
    evento.preventDefault();
    const leitura = { encontroId, codigo: codigo.trim(), lidoEm: new Date().toISOString() };
    setMensagemLocal('');
    onErro('');
    try {
      await registrarPresenca(encontroId, { codigo: leitura.codigo, lidoEm: leitura.lidoEm });
      setMensagemLocal('Presenca registrada.');
      setCodigo('');
    } catch (falha) {
      if (!falha.status) {
        const fila = [...lerFilaPresencas(), leitura];
        salvarFilaPresencas(fila);
        setPendentes(fila);
        setMensagemLocal('Sem conexao. Leitura guardada para reenvio.');
      } else onErro(falha.message);
    }
  }

  return (
    <section className="cartao m3-formulario">
      <p className="rotulo">Area do participante</p>
      <h2>Registrar presenca</h2>
      <p className="texto-suave">Digite o codigo exibido pela organizacao. A leitura fica guardada se a rede cair.</p>
      <form onSubmit={enviar} className="formulario-presenca">
        <SeletorEncontro encontros={encontros} value={encontroId} onChange={setEncontroId} />
        <label>Codigo QR<input value={codigo} onChange={(evento) => setCodigo(evento.target.value.toUpperCase())} placeholder="K7M2QX" maxLength="6" required /></label>
        <button type="submit">Confirmar presenca</button>
      </form>
      {mensagemLocal && <p className="sucesso">{mensagemLocal}</p>}
      {pendentes.length > 0 && <p className="fila-offline">{pendentes.length} leitura(s) aguardando conexao.</p>}
    </section>
  );
}

function TelaListaPresencas({ encontros, onErro }) {
  const [encontroId, setEncontroId] = useState('');
  const [presencas, setPresencas] = useState([]);

  useEffect(() => {
    if (!encontroId && encontros[0]) setEncontroId(encontros[0].id);
  }, [encontros, encontroId]);

  useEffect(() => {
    if (!encontroId) return;
    listarPresencas(encontroId).then(setPresencas).catch((falha) => onErro(falha.message));
  }, [encontroId, onErro]);

  return (
    <section className="cartao lista-presencas">
      <div className="secao-cabecalho">
        <div><p className="rotulo">Painel da organizacao</p><h2>Presencas registradas</h2></div>
        <SeletorEncontro encontros={encontros} value={encontroId} onChange={setEncontroId} />
      </div>
      {!presencas.length ? <p className="estado-vazio">Nenhuma presenca neste encontro.</p> : (
        <div className="tabela-wrap"><table><thead><tr><th>Participante</th><th>Origem</th><th>Leitura</th><th>Registro</th></tr></thead><tbody>
          {presencas.map((presenca) => <tr key={presenca.id}><td>{presenca.participanteId}</td><td><span className="origem">{presenca.origem}</span></td><td>{formatarDataHora(presenca.lidoEm)}</td><td>{formatarDataHora(presenca.registradaEm)}</td></tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}

const FILA_PRESENCAS = 'm3-presencas-offline';

function lerFilaPresencas() {
  try { return JSON.parse(localStorage.getItem(FILA_PRESENCAS) || '[]'); } catch { return []; }
}

function salvarFilaPresencas(fila) {
  localStorage.setItem(FILA_PRESENCAS, JSON.stringify(fila));
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
