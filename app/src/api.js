const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const USUARIO_VISUALIZACAO = 'p-carla';
const USUARIO_ORGANIZACAO = 'org-ana';

async function requisitar(caminho, opcoes = {}) {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      'X-Usuario': opcoes.usuario || USUARIO_VISUALIZACAO,
      ...(opcoes.headers || {}),
    },
  });

  if (resposta.status === 204) return null;

  const corpo = await resposta.json();
  if (!resposta.ok) {
    const falha = new Error(corpo.erro ? `${corpo.erro}: ${corpo.mensagem || corpo.erro}` : 'Erro na API');
    falha.status = resposta.status;
    throw falha;
  }
  return corpo;
}

export function listarSalas() {
  return requisitar('/salas');
}

export function listarAtividades({ dia, tipo } = {}) {
  const params = new URLSearchParams();
  if (dia) params.set('dia', dia);
  if (tipo) params.set('tipo', tipo);
  const consulta = params.toString();
  return requisitar(`/atividades${consulta ? `?${consulta}` : ''}`);
}

export function obterAtividade(id) {
  return requisitar(`/atividades/${id}`);
}

export function criarAtividade(atividade) {
  return requisitar('/atividades', {
    method: 'POST',
    usuario: USUARIO_ORGANIZACAO,
    body: JSON.stringify(atividade),
  });
}

export function obterCodigoEncontro(encontroId) {
  return requisitar(`/encontros/${encontroId}/codigo`, { usuario: USUARIO_ORGANIZACAO });
}

export function registrarPresenca(encontroId, dados) {
  return requisitar(`/encontros/${encontroId}/presencas`, {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

export function listarPresencas(encontroId) {
  return requisitar(`/encontros/${encontroId}/presencas`, { usuario: USUARIO_ORGANIZACAO });
}
