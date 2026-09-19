import Database from 'better-sqlite3';
import express from 'express';
import { createHash, randomBytes } from 'node:crypto';

const USUARIOS_INICIAIS = [
  ['org-ana', 'Ana Beatriz Lima', 'organizacao'],
  ['org-bruno', 'Bruno Tavares', 'organizacao'],
  ['p-carla', 'Carla Mendes Souza', 'participante'],
  ['p-diego', 'Diego Alves', 'participante'],
  ['p-elisa', 'Elisa Fernandes da Rocha', 'participante'],
  ['p-fabio', 'Fábio Nogueira', 'participante'],
  ['p-gabriela', 'Gabriela Moura Castro', 'participante'],
  ['p-heitor', 'Heitor Campos', 'participante'],
  ['p-isadora', 'Isadora Ribeiro dos Santos', 'participante'],
  ['p-joao', 'João Pedro Martins', 'participante'],
];

const SALAS_INICIAIS = [
  ['auditorio', 'Auditório Central', 200],
  ['sala-101', 'Sala 101', 40],
  ['sala-102', 'Sala 102', 40],
  ['lab-3', 'Laboratório 3', 20],
];

function erro(res, status, codigo, mensagem = codigo) {
  return res.status(status).json({ erro: codigo, mensagem });
}

function criarBanco() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      papel TEXT NOT NULL
    );

    CREATE TABLE salas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      capacidade INTEGER NOT NULL
    );

    CREATE TABLE atividades (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      salaId TEXT NOT NULL,
      vagas INTEGER NOT NULL,
      cancelada INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE encontros (
      id TEXT PRIMARY KEY,
      atividadeId TEXT NOT NULL,
      inicio TEXT NOT NULL,
      fim TEXT NOT NULL
    );

    CREATE TABLE inscricoes (
      id TEXT PRIMARY KEY,
      atividadeId TEXT NOT NULL,
      participanteId TEXT,
      status TEXT NOT NULL,
      criadaEm TEXT NOT NULL,
      convocadaAte TEXT
    );

    CREATE TABLE presencas (
      id TEXT PRIMARY KEY,
      encontroId TEXT NOT NULL,
      participanteId TEXT NOT NULL,
      origem TEXT NOT NULL,
      lidoEm TEXT NOT NULL,
      registradaEm TEXT NOT NULL,
      justificativa TEXT,
      UNIQUE (encontroId, participanteId)
    );
  `);
  return db;
}

function carregarDadosIniciais(db) {
  db.exec('DELETE FROM presencas; DELETE FROM inscricoes; DELETE FROM encontros; DELETE FROM atividades; DELETE FROM salas; DELETE FROM usuarios;');

  const inserirUsuario = db.prepare('INSERT INTO usuarios (id, nome, papel) VALUES (?, ?, ?)');
  for (const usuario of USUARIOS_INICIAIS) inserirUsuario.run(...usuario);

  const inserirSala = db.prepare('INSERT INTO salas (id, nome, capacidade) VALUES (?, ?, ?)');
  for (const sala of SALAS_INICIAIS) inserirSala.run(...sala);
}

function gerarId(prefixo) {
  return `${prefixo}_${randomBytes(4).toString('hex')}`;
}

const ALFABETO_QR = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function gerarCodigoQr(encontroId, minuto) {
  const bytes = createHash('sha256').update(`${encontroId}:${minuto}`).digest();
  let codigo = '';
  for (let indice = 0; indice < 6; indice += 1) {
    codigo += ALFABETO_QR[(bytes[indice] + encontroId.charCodeAt(indice % encontroId.length) + minuto) % ALFABETO_QR.length];
  }
  return codigo;
}

function cargaHorariaMinutos(encontros) {
  return encontros.reduce((total, encontro) => {
    return total + (Date.parse(encontro.fim) - Date.parse(encontro.inicio)) / 60000;
  }, 0);
}

const AGORA_INICIAL_TESTE = '2026-10-13T09:00:00-03:00';

function calcularSituacao(atividade, encontros, agoraIso) {
  if (atividade.cancelada) return 'cancelada';

  const agora = Date.parse(agoraIso);
  const primeiroInicio = Date.parse(encontros[0].inicio);
  const ultimoFim = Date.parse(encontros[encontros.length - 1].fim);

  if (agora < primeiroInicio) return 'prevista';
  if (agora >= ultimoFim) return 'encerrada';
  return 'em_andamento';
}

function montarAtividade(db, atividade, agoraIso) {
  const encontros = db
    .prepare('SELECT id, inicio, fim FROM encontros WHERE atividadeId = ? ORDER BY datetime(inicio) ASC')
    .all(atividade.id);
  const ocupadas = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM inscricoes
       WHERE atividadeId = ? AND status IN ('confirmada', 'convocada')`,
    )
    .get(atividade.id).total;
  const emEspera = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM inscricoes
       WHERE atividadeId = ? AND status = 'em_espera'`,
    )
    .get(atividade.id).total;

  return {
    id: atividade.id,
    titulo: atividade.titulo,
    tipo: atividade.tipo,
    salaId: atividade.salaId,
    vagas: atividade.vagas,
    encontros,
    cargaHorariaMinutos: cargaHorariaMinutos(encontros),
    situacao: calcularSituacao(atividade, encontros, agoraIso),
    ocupadas,
    vagasRestantes: atividade.vagas - ocupadas,
    emEspera,
  };
}

function diaEmBrasilia(iso) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valor.year}-${valor.month}-${valor.day}`;
}

function minutosEntre(inicio, fim) {
  return (Date.parse(fim) - Date.parse(inicio)) / 60000;
}

function encontrosValidos(encontros) {
  const ordenados = [...encontros].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));

  for (let indice = 0; indice < ordenados.length; indice += 1) {
    const encontro = ordenados[indice];
    const inicio = Date.parse(encontro.inicio);
    const fim = Date.parse(encontro.fim);
    const duracao = minutosEntre(encontro.inicio, encontro.fim);
    const diaInicio = diaEmBrasilia(encontro.inicio);
    const diaFim = diaEmBrasilia(encontro.fim);

    if (
      Number.isNaN(inicio) ||
      Number.isNaN(fim) ||
      duracao < 60 ||
      duracao > 240 ||
      diaInicio !== diaFim ||
      diaInicio < '2026-10-19' ||
      diaInicio > '2026-10-23'
    ) {
      return false;
    }

    if (indice > 0 && Date.parse(ordenados[indice - 1].fim) > inicio) return false;
  }

  return true;
}

function existeConflitoDeSala(db, salaId, encontros) {
  const encontrosExistentes = db
    .prepare(
      `SELECT e.inicio, e.fim
       FROM encontros e
       JOIN atividades a ON a.id = e.atividadeId
       WHERE a.salaId = ? AND a.cancelada = 0`,
    )
    .all(salaId);

  return encontros.some((novo) => {
    const novoInicio = Date.parse(novo.inicio);
    const novoFim = Date.parse(novo.fim);

    return encontrosExistentes.some((existente) => {
      const existenteInicio = Date.parse(existente.inicio);
      const existenteFim = Date.parse(existente.fim);
      return novoInicio < existenteFim + 15 * 60000 && existenteInicio < novoFim + 15 * 60000;
    });
  });
}

function exigirOrganizacao(req, res, next) {
  if (req.usuario.papel !== 'organizacao') return erro(res, 403, 'SOMENTE_ORGANIZACAO');
  next();
}

function exigirParticipante(req, res, next) {
  if (req.usuario.papel !== 'participante') return erro(res, 403, 'SOMENTE_PARTICIPANTE');
  next();
}

function corpoAtividadeValido(corpo) {
  return (
    corpo &&
    typeof corpo.titulo === 'string' &&
    typeof corpo.tipo === 'string' &&
    typeof corpo.salaId === 'string' &&
    Number.isInteger(corpo.vagas) &&
    Array.isArray(corpo.encontros) &&
    corpo.encontros.every(
      (encontro) => typeof encontro.inicio === 'string' && typeof encontro.fim === 'string',
    )
  );
}

function corpoPatchAtividadeValido(corpo) {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return false;
  if ('titulo' in corpo && typeof corpo.titulo !== 'string') return false;
  if ('vagas' in corpo && !Number.isInteger(corpo.vagas)) return false;
  return true;
}

export function criarServidor({ modoTeste = process.env.MODO_TESTE === '1' } = {}) {
  const app = express();
  const db = criarBanco();
  carregarDadosIniciais(db);
  let agoraControlado = AGORA_INICIAL_TESTE;

  function agora() {
    return modoTeste ? agoraControlado : new Date().toISOString();
  }

  app.use(express.json());

  app.use((error, _req, res, next) => {
    if (error instanceof SyntaxError) return erro(res, 422, 'DADOS_INVALIDOS');
    next(error);
  });

  if (modoTeste) {
    app.post('/_teste/reset', (_req, res) => {
      carregarDadosIniciais(db);
      agoraControlado = AGORA_INICIAL_TESTE;
      res.status(204).end();
    });

    app.put('/_teste/relogio', (req, res) => {
      if (!req.body || typeof req.body.agora !== 'string' || Number.isNaN(Date.parse(req.body.agora))) {
        return erro(res, 422, 'DADOS_INVALIDOS');
      }

      agoraControlado = req.body.agora;
      res.json({ agora: agoraControlado });
    });

    app.get('/_teste/relogio', (_req, res) => {
      res.json({ agora: agoraControlado });
    });

  }

  app.use((req, res, next) => {
    if (req.path.startsWith('/_teste/')) return erro(res, 404, 'NAO_ENCONTRADO');

    const usuarioId = req.get('X-Usuario');
    const usuario = usuarioId
      ? db.prepare('SELECT id, nome, papel FROM usuarios WHERE id = ?').get(usuarioId)
      : null;

    if (!usuario) return erro(res, 401, 'USUARIO_DESCONHECIDO');

    req.usuario = usuario;
    next();
  });

  function atividadeComEncontros(atividadeId) {
    const atividade = db.prepare('SELECT * FROM atividades WHERE id = ?').get(atividadeId);
    if (!atividade) return null;
    return { ...atividade, encontros: db.prepare('SELECT id, inicio, fim FROM encontros WHERE atividadeId = ? ORDER BY datetime(inicio)').all(atividadeId) };
  }

  function fechamento(atividade) {
    return Date.parse(atividade.encontros[0].inicio) - 30 * 60000;
  }

  function conflito(atividadeId, participanteId, novaAtividadeId) {
    const novos = atividadeComEncontros(novaAtividadeId).encontros;
    const existentes = db.prepare(
      `SELECT e.inicio, e.fim FROM encontros e JOIN inscricoes i ON i.atividadeId = e.atividadeId
       WHERE i.participanteId = ? AND i.status IN ('confirmada', 'convocada') AND i.atividadeId <> ?`,
    ).all(participanteId, novaAtividadeId);
    return novos.some((novo) => existentes.some((existente) => Date.parse(novo.inicio) < Date.parse(existente.fim) && Date.parse(existente.inicio) < Date.parse(novo.fim)));
  }

  function minicursosOcupando(participanteId) {
    return db.prepare(
      `SELECT COUNT(*) AS total FROM inscricoes i JOIN atividades a ON a.id = i.atividadeId
       WHERE i.participanteId = ? AND i.status IN ('confirmada', 'convocada') AND a.tipo = 'minicurso'`,
    ).get(participanteId).total;
  }

  function reconciliar() {
    const agoraMs = Date.parse(agora());
    const atividades = db.prepare('SELECT * FROM atividades').all();
    for (const atividadeBase of atividades) {
      const atividade = atividadeComEncontros(atividadeBase.id);
      if (atividade.cancelada) continue;
      const fechaEm = fechamento(atividade);
      let mudou = true;
      while (mudou) {
        mudou = false;
        const expiradas = db.prepare(
          `SELECT * FROM inscricoes WHERE atividadeId = ? AND status = 'convocada' AND datetime(convocadaAte) < datetime(?)`,
        ).all(atividade.id, agora());
        for (const inscricao of expiradas) {
          const prazoAnterior = inscricao.convocadaAte;
          db.prepare("UPDATE inscricoes SET status = 'expirada', convocadaAte = NULL WHERE id = ?").run(inscricao.id);
          if (agoraMs < fechaEm) {
            const proxima = db.prepare(
              `SELECT * FROM inscricoes WHERE atividadeId = ? AND status = 'em_espera' ORDER BY datetime(criadaEm), id LIMIT 1`,
            ).get(atividade.id);
            if (proxima) {
              const prazo = Math.min(Date.parse(prazoAnterior) + 2 * 60 * 60000, fechaEm);
              db.prepare("UPDATE inscricoes SET status = 'convocada', convocadaAte = ? WHERE id = ?").run(new Date(prazo).toISOString(), proxima.id);
            }
          }
          mudou = true;
        }
      }
    }
  }

  function convocarVagas(atividadeId, quantidade) {
    const atividade = atividadeComEncontros(atividadeId);
    if (!atividade || atividade.cancelada || Date.parse(agora()) >= fechamento(atividade)) return;
    const fila = db.prepare("SELECT * FROM inscricoes WHERE atividadeId = ? AND status = 'em_espera' ORDER BY datetime(criadaEm), id").all(atividadeId);
    const vagas = Math.min(quantidade, fila.length);
    const prazo = new Date(Math.min(Date.parse(agora()) + 2 * 60 * 60000, fechamento(atividade))).toISOString();
    for (let indice = 0; indice < vagas; indice += 1) {
      db.prepare("UPDATE inscricoes SET status = 'convocada', convocadaAte = ? WHERE id = ?").run(prazo, fila[indice].id);
    }
  }

  function apresentarInscricao(inscricao) {
    const posicao = inscricao.status === 'em_espera'
      ? db.prepare("SELECT COUNT(*) AS total FROM inscricoes WHERE atividadeId = ? AND status = 'em_espera' AND (datetime(criadaEm) < datetime(?) OR (criadaEm = ? AND id <= ?))").get(inscricao.atividadeId, inscricao.criadaEm, inscricao.criadaEm, inscricao.id).total
      : null;
    return { id: inscricao.id, atividadeId: inscricao.atividadeId, participanteId: inscricao.participanteId, status: inscricao.status, posicaoNaEspera: posicao, convocadaAte: inscricao.status === 'convocada' ? inscricao.convocadaAte : null, criadaEm: inscricao.criadaEm };
  }

  app.use((req, _res, next) => { reconciliar(); next(); });

  app.post('/atividades/:id/inscricoes', exigirParticipante, (req, res) => {
    const atividade = atividadeComEncontros(req.params.id);
    if (!atividade) return erro(res, 404, 'NAO_ENCONTRADO');
    if (atividade.cancelada) return erro(res, 422, 'ATIVIDADE_CANCELADA');
    if (Date.parse(agora()) >= fechamento(atividade)) return erro(res, 422, 'INSCRICOES_ENCERRADAS');
    const ativa = db.prepare("SELECT * FROM inscricoes WHERE atividadeId = ? AND participanteId = ? AND status IN ('confirmada', 'em_espera', 'convocada')").get(req.params.id, req.usuario.id);
    if (ativa) return erro(res, 409, 'JA_INSCRITO');
    const ocupadas = db.prepare("SELECT COUNT(*) AS total FROM inscricoes WHERE atividadeId = ? AND status IN ('confirmada', 'convocada')").get(req.params.id).total;
    const status = ocupadas < atividade.vagas ? 'confirmada' : 'em_espera';
    if (status === 'confirmada' && conflito(req.params.id, req.usuario.id, req.params.id)) return erro(res, 409, 'CONFLITO_DE_HORARIO');
    if (status === 'confirmada' && atividade.tipo === 'minicurso' && minicursosOcupando(req.usuario.id) >= 3) return erro(res, 422, 'LIMITE_DE_MINICURSOS');
    const inscricao = { id: gerarId('ins'), atividadeId: req.params.id, participanteId: req.usuario.id, status, criadaEm: agora(), convocadaAte: null };
    db.prepare('INSERT INTO inscricoes (id, atividadeId, participanteId, status, criadaEm, convocadaAte) VALUES (?, ?, ?, ?, ?, ?)').run(inscricao.id, inscricao.atividadeId, inscricao.participanteId, inscricao.status, inscricao.criadaEm, null);
    return res.status(201).json(apresentarInscricao(inscricao));
  });

  app.get('/inscricoes', (req, res) => {
    const condicoes = [];
    const parametros = [];
    if (req.usuario.papel !== 'organizacao') {
      condicoes.push('participanteId = ?');
      parametros.push(req.usuario.id);
    }
    if (req.query.atividadeId) {
      condicoes.push('atividadeId = ?');
      parametros.push(req.query.atividadeId);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const inscricoes = db.prepare(`SELECT * FROM inscricoes ${where} ORDER BY datetime(criadaEm) DESC, id DESC`).all(...parametros);
    return res.json(inscricoes.map(apresentarInscricao));
  });

  app.get('/inscricoes/:id', (req, res) => {
    const inscricao = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(req.params.id);
    if (!inscricao || (req.usuario.papel !== 'organizacao' && inscricao.participanteId !== req.usuario.id)) return erro(res, 404, 'NAO_ENCONTRADO');
    return res.json(apresentarInscricao(inscricao));
  });

  app.post('/inscricoes/:id/cancelamento', exigirParticipante, (req, res) => {
    const inscricao = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(req.params.id);
    if (!inscricao || inscricao.participanteId !== req.usuario.id) return erro(res, 404, 'NAO_ENCONTRADO');
    const atividade = atividadeComEncontros(inscricao.atividadeId);
    if (Date.parse(agora()) >= Date.parse(atividade.encontros[0].inicio)) return erro(res, 422, 'ATIVIDADE_JA_INICIADA');
    if (!['confirmada', 'convocada', 'em_espera'].includes(inscricao.status)) return erro(res, 422, 'INSCRICAO_INATIVA');
    const liberou = ['confirmada', 'convocada'].includes(inscricao.status);
    db.prepare("UPDATE inscricoes SET status = 'cancelada', convocadaAte = NULL WHERE id = ?").run(inscricao.id);
    if (liberou) convocarVagas(inscricao.atividadeId, 1);
    return res.json(apresentarInscricao(db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(inscricao.id)));
  });

  app.post('/inscricoes/:id/confirmacao', exigirParticipante, (req, res) => {
    const inscricao = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(req.params.id);
    if (!inscricao || inscricao.participanteId !== req.usuario.id) return erro(res, 404, 'NAO_ENCONTRADO');
    const atividade = atividadeComEncontros(inscricao.atividadeId);
    if (atividade.cancelada) return erro(res, 422, 'ATIVIDADE_CANCELADA');
    if (inscricao.status !== 'convocada') return erro(res, 422, inscricao.status === 'expirada' ? 'CONVOCACAO_EXPIRADA' : 'SEM_CONVOCACAO');
    if (conflito(inscricao.atividadeId, req.usuario.id, inscricao.atividadeId)) return erro(res, 409, 'CONFLITO_DE_HORARIO');
    if (atividade.tipo === 'minicurso' && minicursosOcupando(req.usuario.id) - 1 >= 3) return erro(res, 422, 'LIMITE_DE_MINICURSOS');
    db.prepare("UPDATE inscricoes SET status = 'confirmada', convocadaAte = NULL WHERE id = ?").run(inscricao.id);
    return res.json(apresentarInscricao(db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(inscricao.id)));
  });

  app.get('/salas', (_req, res) => {
    const salas = db.prepare('SELECT id, nome, capacidade FROM salas ORDER BY rowid').all();
    res.json(salas);
  });

  app.get('/encontros/:id/codigo', exigirOrganizacao, (req, res) => {
    const encontro = db
      .prepare(
        `SELECT e.id, e.inicio, a.cancelada
         FROM encontros e
         JOIN atividades a ON a.id = e.atividadeId
         WHERE e.id = ?`,
      )
      .get(req.params.id);
    if (!encontro) return erro(res, 404, 'NAO_ENCONTRADO');
    if (encontro.cancelada) return erro(res, 422, 'ATIVIDADE_CANCELADA');

    const agoraMs = Date.parse(agora());
    const inicioMs = Date.parse(encontro.inicio);
    if (agoraMs < inicioMs - 15 * 60000 || agoraMs > inicioMs + 30 * 60000) {
      return erro(res, 422, 'FORA_DA_JANELA');
    }

    const inicioDoMinutoMs = Math.floor(agoraMs / 60000) * 60000;
    const minuto = Math.floor(inicioDoMinutoMs / 60000);
    const trocaEm = new Date(inicioDoMinutoMs + 60000).toISOString();
    const validoAte = new Date(inicioDoMinutoMs + 120000).toISOString();
    return res.json({
      encontroId: encontro.id,
      codigo: gerarCodigoQr(encontro.id, minuto),
      trocaEm,
      validoAte,
    });
  });

  app.post('/encontros/:id/presencas', exigirParticipante, (req, res) => {
    const encontro = db
      .prepare('SELECT e.id, e.inicio, e.fim, e.atividadeId FROM encontros e JOIN atividades a ON a.id = e.atividadeId WHERE e.id = ?')
      .get(req.params.id);
    if (!encontro) return erro(res, 404, 'NAO_ENCONTRADO');

    const existente = db
      .prepare('SELECT * FROM presencas WHERE encontroId = ? AND participanteId = ?')
      .get(encontro.id, req.usuario.id);
    if (existente) return res.status(200).json(existente);

    if (!req.body || typeof req.body.codigo !== 'string') return erro(res, 422, 'DADOS_INVALIDOS');

    const inscricao = db
      .prepare(
        `SELECT 1 FROM inscricoes
         WHERE atividadeId = ? AND participanteId = ? AND status = 'confirmada'`,
      )
      .get(encontro.atividadeId, req.usuario.id);
    if (!inscricao) return erro(res, 403, 'NAO_INSCRITO');

    const registradaEm = agora();
    const leituraOffline = typeof req.body?.lidoEm === 'string';
    const lidoEmEnviado = leituraOffline ? req.body.lidoEm : registradaEm;
    const lidoEm = leituraOffline && Date.parse(lidoEmEnviado) > Date.parse(registradaEm)
      ? registradaEm
      : lidoEmEnviado;
    const instanteRegraMs = Date.parse(lidoEm);
    const inicioMs = Date.parse(encontro.inicio);
    const fimMs = Date.parse(encontro.fim);
    if (Number.isNaN(instanteRegraMs)) return erro(res, 422, 'DADOS_INVALIDOS');
    if (leituraOffline && Date.parse(registradaEm) > fimMs + 2 * 60 * 60000) {
      return erro(res, 422, 'SINCRONIZACAO_TARDIA');
    }
    if (instanteRegraMs < inicioMs - 15 * 60000 || instanteRegraMs > inicioMs + 30 * 60000) {
      return erro(res, 422, 'FORA_DA_JANELA');
    }

    const codigo = req.body.codigo.replaceAll(' ', '').toUpperCase();
    const minuto = Math.floor(instanteRegraMs / 60000);
    if (codigo !== gerarCodigoQr(encontro.id, minuto) && codigo !== gerarCodigoQr(encontro.id, minuto - 1)) {
      return erro(res, 422, 'CODIGO_INVALIDO');
    }

    const presenca = {
      id: gerarId('pre'),
      encontroId: encontro.id,
      participanteId: req.usuario.id,
      origem: leituraOffline ? 'qr_offline' : 'qr',
      lidoEm,
      registradaEm,
      justificativa: null,
    };
    db.prepare(
      `INSERT INTO presencas
       (id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      presenca.id,
      presenca.encontroId,
      presenca.participanteId,
      presenca.origem,
      presenca.lidoEm,
      presenca.registradaEm,
      presenca.justificativa,
    );
    return res.status(201).json(presenca);
  });

  app.post('/encontros/:id/presencas/manual', exigirOrganizacao, (req, res) => {
    const encontro = db
      .prepare('SELECT e.id, e.inicio, e.fim, e.atividadeId FROM encontros e WHERE e.id = ?')
      .get(req.params.id);
    if (!encontro) return erro(res, 404, 'NAO_ENCONTRADO');

    const justificativa = req.body?.justificativa;
    if (typeof justificativa !== 'string' || justificativa.trim().length < 10) {
      return erro(res, 422, 'JUSTIFICATIVA_OBRIGATORIA');
    }

    const participanteId = req.body?.participanteId;
    if (typeof participanteId !== 'string') return erro(res, 422, 'DADOS_INVALIDOS');
    const existente = db
      .prepare('SELECT * FROM presencas WHERE encontroId = ? AND participanteId = ?')
      .get(encontro.id, participanteId);
    if (existente) return res.status(200).json(existente);

    const inscricao = db
      .prepare(
        `SELECT 1 FROM inscricoes
         WHERE atividadeId = ? AND participanteId = ? AND status = 'confirmada'`,
      )
      .get(encontro.atividadeId, participanteId);
    if (!inscricao) return erro(res, 403, 'NAO_INSCRITO');

    const registradaEm = agora();
    const registradaMs = Date.parse(registradaEm);
    const inicioMs = Date.parse(encontro.inicio);
    const fimMs = Date.parse(encontro.fim);
    if (registradaMs < inicioMs - 15 * 60000 || registradaMs > fimMs + 2 * 60 * 60000) {
      return erro(res, 422, 'FORA_DA_JANELA');
    }

    const confirmadas = db
      .prepare("SELECT COUNT(*) AS total FROM inscricoes WHERE atividadeId = ? AND status = 'confirmada'")
      .get(encontro.atividadeId).total;
    const manuais = db
      .prepare("SELECT COUNT(*) AS total FROM presencas WHERE encontroId = ? AND origem = 'manual'")
      .get(encontro.id).total;
    if (manuais >= Math.ceil(confirmadas * 0.1)) {
      return erro(res, 422, 'LIMITE_DE_MANUAIS');
    }

    const presenca = {
      id: gerarId('pre'),
      encontroId: encontro.id,
      participanteId,
      origem: 'manual',
      lidoEm: registradaEm,
      registradaEm,
      justificativa,
    };
    db.prepare(
      `INSERT INTO presencas
       (id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      presenca.id,
      presenca.encontroId,
      presenca.participanteId,
      presenca.origem,
      presenca.lidoEm,
      presenca.registradaEm,
      presenca.justificativa,
    );
    return res.status(201).json(presenca);
  });

  app.get('/encontros/:id/presencas', exigirOrganizacao, (req, res) => {
    const encontro = db.prepare('SELECT id FROM encontros WHERE id = ?').get(req.params.id);
    if (!encontro) return erro(res, 404, 'NAO_ENCONTRADO');

    const presencas = db
      .prepare(
        `SELECT id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa
         FROM presencas
         WHERE encontroId = ?
         ORDER BY datetime(registradaEm) ASC, id ASC`,
      )
      .all(encontro.id);
    return res.json(presencas);
  });

  app.post('/atividades', exigirOrganizacao, (req, res) => {
    if (!corpoAtividadeValido(req.body)) return erro(res, 422, 'DADOS_INVALIDOS');
    if (req.body.tipo === 'palestra' && req.body.encontros.length !== 1) {
      return erro(res, 422, 'QUANTIDADE_DE_ENCONTROS');
    }
    if (req.body.tipo === 'minicurso' && (req.body.encontros.length < 2 || req.body.encontros.length > 5)) {
      return erro(res, 422, 'QUANTIDADE_DE_ENCONTROS');
    }
    if (!['palestra', 'minicurso'].includes(req.body.tipo) || req.body.vagas < 1) {
      return erro(res, 422, 'DADOS_INVALIDOS');
    }

    const sala = db.prepare('SELECT id, capacidade FROM salas WHERE id = ?').get(req.body.salaId);
    if (!sala) return erro(res, 404, 'NAO_ENCONTRADO');
    if (req.body.vagas > sala.capacidade) return erro(res, 422, 'VAGAS_ACIMA_DA_CAPACIDADE');

    if (!encontrosValidos(req.body.encontros)) return erro(res, 422, 'ENCONTRO_INVALIDO');

    if (existeConflitoDeSala(db, req.body.salaId, req.body.encontros)) {
      return erro(res, 409, 'CONFLITO_DE_SALA');
    }

    const id = gerarId('atv');
    const encontrosOrdenados = [...req.body.encontros].sort(
      (a, b) => Date.parse(a.inicio) - Date.parse(b.inicio),
    );

    const inserir = db.transaction(() => {
      db.prepare(
        'INSERT INTO atividades (id, titulo, tipo, salaId, vagas, cancelada) VALUES (?, ?, ?, ?, ?, 0)',
      ).run(id, req.body.titulo, req.body.tipo, req.body.salaId, req.body.vagas);

      const inserirEncontro = db.prepare(
        'INSERT INTO encontros (id, atividadeId, inicio, fim) VALUES (?, ?, ?, ?)',
      );
      for (const encontro of encontrosOrdenados) {
        inserirEncontro.run(gerarId('enc'), id, encontro.inicio, encontro.fim);
      }
    });

    inserir();

    const atividade = db.prepare('SELECT * FROM atividades WHERE id = ?').get(id);
    res.status(201).json(montarAtividade(db, atividade, agora()));
  });

  app.get('/atividades', (req, res) => {
    const atividades = db.prepare('SELECT * FROM atividades').all();
    let resposta = atividades.map((atividade) => montarAtividade(db, atividade, agora()));

    if (req.query.dia) {
      resposta = resposta.filter((atividade) => {
        return atividade.encontros.some((encontro) => diaEmBrasilia(encontro.inicio) === req.query.dia);
      });
    }

    if (req.query.tipo) {
      resposta = resposta.filter((atividade) => atividade.tipo === req.query.tipo);
    }

    resposta.sort((a, b) => {
      const inicioA = Date.parse(a.encontros[0].inicio);
      const inicioB = Date.parse(b.encontros[0].inicio);
      if (inicioA !== inicioB) return inicioA - inicioB;
      return a.titulo.localeCompare(b.titulo, 'pt-BR');
    });

    res.json(resposta);
  });

  app.get('/atividades/:id', (req, res) => {
    const atividade = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    if (!atividade) return erro(res, 404, 'NAO_ENCONTRADO');

    res.json(montarAtividade(db, atividade, agora()));
  });

  app.patch('/atividades/:id', exigirOrganizacao, (req, res) => {
    const atividade = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    if (!atividade) return erro(res, 404, 'NAO_ENCONTRADO');
    if (!corpoPatchAtividadeValido(req.body)) return erro(res, 422, 'DADOS_INVALIDOS');
    if (atividade.cancelada) return erro(res, 422, 'ATIVIDADE_CANCELADA');
    if ('tipo' in req.body || 'salaId' in req.body || 'encontros' in req.body) {
      return erro(res, 422, 'CAMPO_NAO_EDITAVEL');
    }

    const titulo = 'titulo' in req.body ? req.body.titulo : atividade.titulo;
    const vagas = 'vagas' in req.body ? req.body.vagas : atividade.vagas;
    if (vagas < 1) return erro(res, 422, 'DADOS_INVALIDOS');

    const sala = db.prepare('SELECT capacidade FROM salas WHERE id = ?').get(atividade.salaId);
    if (vagas > sala.capacidade) return erro(res, 422, 'VAGAS_ACIMA_DA_CAPACIDADE');

    const inscricoesAtivas = db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM inscricoes
         WHERE atividadeId = ? AND status IN ('confirmada', 'convocada')`,
      )
      .get(req.params.id).total;
    if (vagas < inscricoesAtivas) return erro(res, 409, 'VAGAS_ABAIXO_DOS_INSCRITOS');

    db.prepare('UPDATE atividades SET titulo = ?, vagas = ? WHERE id = ?').run(titulo, vagas, req.params.id);
    if (vagas > atividade.vagas) convocarVagas(req.params.id, vagas - atividade.vagas);
    const atualizada = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    res.json(montarAtividade(db, atualizada, agora()));
  });

  app.post('/atividades/:id/cancelamento', exigirOrganizacao, (req, res) => {
    const atividade = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    if (!atividade) return erro(res, 404, 'NAO_ENCONTRADO');
    if (atividade.cancelada) return erro(res, 422, 'ATIVIDADE_CANCELADA');

    const primeiroEncontro = db
      .prepare('SELECT inicio FROM encontros WHERE atividadeId = ? ORDER BY datetime(inicio) ASC LIMIT 1')
      .get(req.params.id);
    if (Date.parse(agora()) >= Date.parse(primeiroEncontro.inicio)) {
      return erro(res, 422, 'ATIVIDADE_JA_INICIADA');
    }

    db.transaction(() => {
      db.prepare('UPDATE inscricoes SET status = ? WHERE atividadeId = ? AND status IN (?, ?, ?)').run(
        'cancelada',
        req.params.id,
        'confirmada',
        'convocada',
        'em_espera',
      );
      db.prepare('UPDATE atividades SET cancelada = 1 WHERE id = ?').run(req.params.id);
    })();
    const cancelada = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    res.json(montarAtividade(db, cancelada, agora()));
  });

  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const porta = Number(process.env.PORT || 3000);
  criarServidor().listen(porta, () => {
    console.log(`API escutando na porta ${porta}`);
  });
}
