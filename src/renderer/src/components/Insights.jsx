import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtValor } from '../utils/format'
// Configuração visual de cada categoria (card)
const GRUPO_INFO = {
  risco: { titulo: 'Em Risco', icone: '🔴', cor: 'vermelho', descricao: 'Clientes que pararam de comprar e precisam de reativação urgente.' },
  momento: { titulo: 'Momento de Contato', icone: '🟡', cor: 'amarelo', descricao: 'Clientes no momento ideal para você ligar (já passou o intervalo de compra deles).' },
  ranking: { titulo: 'Ranking', icone: '🏆', cor: 'azul', descricao: 'Clientes que saíram do Top 20 ou caíram de posição neste mês.' },
  cross: { titulo: 'Cross-Sell', icone: '🔄', cor: 'verde', descricao: 'Clientes que compram parte da rotina de laboratório, mas nunca compraram materiais complementares da mesma rotina nos últimos 3 meses.' },
  padrao: { titulo: 'Padrão de Compra', icone: '📅', cor: 'roxo', descricao: 'Clientes que costumam comprar na semana atual do mês.' },
  produtos: { titulo: 'Análise de Produtos', icone: '📦', cor: 'laranja', descricao: 'Produtos em alta sazonal neste mês, com base nas notas fiscais.' }
}
// ===== Cores por segmento de laboratório =====
const SEGMENTO_CORES = {
  coleta_sangue: { nome: 'Coleta de Sangue Venoso', cor: '#fde2e2' },
  coleta_urina: { nome: 'Coleta de Urina', cor: '#fef9c3' },
  coleta_fezes: { nome: 'Coleta de Fezes', cor: '#ffedd5' },
  coleta_swab: { nome: 'Coleta de Secreções / Swab', cor: '#fce7f3' },
  hematologia: { nome: 'Hematologia', cor: '#ede9fe' },
  bioquimica: { nome: 'Bioquímica', cor: '#dbeafe' },
  urinalise: { nome: 'Urinálise', cor: '#ccfbf1' },
  imunologia: { nome: 'Imunologia / Sorologia', cor: '#cffafe' },
  testes_rapidos: { nome: 'Testes Rápidos', cor: '#dcfce7' },
  microbiologia: { nome: 'Microbiologia', cor: '#bbf7d0' },
  parasitologia: { nome: 'Parasitologia', cor: '#fef3c7' },
  coagulacao: { nome: 'Coagulação', cor: '#ffe4e6' },
  higienizacao: { nome: 'Higienização e Desinfecção', cor: '#f1f5f9' },
  residuos: { nome: 'Gerenciamento de Resíduos', cor: '#e2e8f0' },
  epis: { nome: 'EPIs e Segurança', cor: '#e0f2fe' }
}
const POR_PAGINA = 5
export default function Insights({ usuario }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const avisoTimer = useRef(null)
  const mostrarAviso = (msg) => {
    setAviso(msg)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 3000)
  }
  const [grupoAtivo, setGrupoAtivo] = useState(null)
  const [processando, setProcessando] = useState('')
  const [pagina, setPagina] = useState(1)
  const [dicaAberta, setDicaAberta] = useState(null)
  // ===== Controla qual produto está sendo mapeado (para o botão) =====
  const [mapeando, setMapeando] = useState(null)
  // ===== Controla qual produto está com o menu de mapeamento aberto =====
  const [menuAberto, setMenuAberto] = useState(null)
  function carregar() {
    setCarregando(true)
    setErro('')
    window.api
      .gerarInsights()
      .then((res) => {
        setDados(res)
        if (res && res.grupos) {
          for (const g of res.grupos) {
            for (const d of g.itens) {
              if (d.novo) {
                window.api.marcarInsight({ acao: 'ver', chave: d.tipo + ':' + d.clienteId })
              }
            }
          }
        }
      })
      .catch(() => setErro('Não foi possível carregar as dicas. Tente novamente.'))
      .finally(() => setCarregando(false))
  }
  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])
  async function marcar(acao, chave) {
    if (processando) return
    setProcessando(chave)
    try {
      await window.api.marcarInsight({ acao, chave })
      mostrarAviso(acao === 'tratar' ? '✅ Dica tratada!' : '⏸️ Dica adiada.')
      carregar()
    } catch {
      mostrarAviso('Erro ao processar a dica. Tente novamente.')
    } finally {
      setProcessando('')
    }
  }
  // ===== Mapeia um produto para um segmento (salva no segmentos.json) =====
  async function mapearProduto(p, segmentoId) {
    setMapeando(p.codigo)
    setMenuAberto(null)
    try {
      const res = await window.api.segmentosMapear({
        codigo: p.codigo,
        descricao: p.descricao,
        segmentoId
      })
      if (res && res.ok) {
        mostrarAviso(segmentoId ? '✅ Segmento mapeado! Produtos similares serão reconhecidos.' : '🗑️ Segmento removido.')
        setDicaAberta(null)
        carregar()
      } else {
        mostrarAviso('⚠️ ' + ((res && res.erro) || 'Erro ao mapear o segmento.'))
      }
    } catch {
      mostrarAviso('⚠️ Erro ao mapear o segmento.')
    } finally {
      setMapeando(null)
    }
  }
  const totalOportunidades = useMemo(() => {
    if (!dados || !dados.grupos) return 0
    return dados.grupos.reduce((s, g) => s + g.total, 0)
  }, [dados])
  useEffect(() => {
    setPagina(1)
    setDicaAberta(null)
  }, [grupoAtivo])
  if (carregando) {
    return (
      <div className="painel">
        <h2>🧠 Dicas Inteligentes</h2>
        <div className="insights-loading">
          <span className="spinner"></span>
          <p>Calculando dicas...</p>
        </div>
      </div>
    )
  }
  if (erro) {
    return (
      <div className="painel">
        <h2>🧠 Dicas Inteligentes</h2>
        <p className="form-erro">{erro}</p>
        <button className="btn-primary" onClick={carregar}>🔄 Tentar novamente</button>
      </div>
    )
  }
  if (!dados || !dados.grupos || totalOportunidades === 0) {
    return (
      <div className="painel">
        <h2>🧠 Dicas Inteligentes</h2>
        <p>Nenhuma oportunidade pendente no momento. Novas sugestões aparecem aqui conforme os padrões de compra se formam.</p>
        <button className="btn-secondary" onClick={carregar}>🔄 Atualizar</button>
      </div>
    )
  }
  // ===== Janela (modal) com as notas e produtos da dica =====
  if (dicaAberta) {
    const d = dicaAberta
    const notas = Array.isArray(d.notasDetalhe) ? d.notasDetalhe : []
    // ===== Agrupa os segmentos presentes para a legenda =====
    const segmentosPresentes = {}
    notas.forEach((nota) => {
      ;(nota.produtos || []).forEach((p) => {
        if (p.segmentoId && SEGMENTO_CORES[p.segmentoId] && !segmentosPresentes[p.segmentoId]) {
          segmentosPresentes[p.segmentoId] = SEGMENTO_CORES[p.segmentoId]
        }
      })
    })
    return (
      <div className="painel">
        {aviso && <div className="toast-sucesso">{aviso}</div>}
        <div className="modal-overlay" onClick={() => setDicaAberta(null)}>
          <div className="modal-janela" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cabecalho">
              <h3>🧾 Notas e Produtos — [{d.codigo || d.clienteId}] {d.nome}</h3>
              <button className="modal-fechar" onClick={() => setDicaAberta(null)} title="Fechar">✕</button>
            </div>
            <div className="modal-corpo" onClick={() => setMenuAberto(null)}>
              <p className="insights-descricao">Últimos 3 meses ({notas.length} {notas.length === 1 ? 'nota' : 'notas'})</p>
              {/* ===== Legenda de cores por segmento ===== */}
              {Object.keys(segmentosPresentes).length > 0 && (
                <div className="segmento-legenda">
                  {Object.keys(segmentosPresentes).map((sid) => (
                    <span key={sid} className="segmento-chave" style={{ backgroundColor: segmentosPresentes[sid].cor }}>
                      {segmentosPresentes[sid].nome}
                    </span>
                  ))}
                </div>
              )}
              {notas.length === 0 ? (
                <p className="empty">Nenhuma nota encontrada nos últimos 3 meses.</p>
              ) : (
                notas.map((nota, i) => (
                  <div key={i} className="nota-item">
                    <div className="nota-cabecalho">
                      <strong>NFE-{nota.numero || '—'}</strong>
                      <span className="nota-data">{nota.data}</span>
                    </div>
                    {(nota.produtos || []).length === 0 ? (
                      <small>Sem produtos nesta nota.</small>
                    ) : (
                      <ul className="nota-produtos">
                        {(nota.produtos || []).map((p, j) => {
                          const segInfo = p.segmentoId && SEGMENTO_CORES[p.segmentoId]
                          return (
                            <li
                              key={j}
                              className="nota-produto"
                              style={{ backgroundColor: segInfo ? segInfo.cor : '#f8fafc' }}
                            >
                              <span className="nota-desc">{p.descricao || p.codigo}</span>
                              {p.quantidade > 0 && <span className="nota-qtd"> × {p.quantidade}{p.unidade ? ' ' + p.unidade : ''}</span>}
                              {p.segmento && <span className="nota-segmento">— {p.segmento}</span>}
                              {/* ===== Menu personalizado para mapear/re-mapear o segmento ===== */}
                              <div className="mapear-wrap">
                                <button
                                  type="button"
                                  className="mapear-btn"
                                  disabled={mapeando === p.codigo}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setMenuAberto(menuAberto === p.codigo ? null : p.codigo)
                                  }}
                                >
                                  {mapeando === p.codigo ? '...' : (p.segmentoId ? '🔄 Trocar' : '🗂️ Mapear')}
                                </button>
                                {menuAberto === p.codigo && (
                                  <div className="mapear-menu" onClick={(e) => e.stopPropagation()}>
                                    <div className="mapear-menu-titulo">
                                      {p.descricao || p.codigo}
                                    </div>
                                    {Object.keys(SEGMENTO_CORES).map((sid) => (
                                      <button
                                        key={sid}
                                        type="button"
                                        className={'mapear-opcao' + (p.segmentoId === sid ? ' mapear-opcao-ativa' : '')}
                                        onClick={() => mapearProduto(p, sid)}
                                      >
                                        <span className="mapear-bolinha" style={{ backgroundColor: SEGMENTO_CORES[sid].cor }}></span>
                                        {SEGMENTO_CORES[sid].nome}
                                      </button>
                                    ))}
                                    {p.segmentoId && (
                                      <button
                                        type="button"
                                        className="mapear-opcao mapear-limpar"
                                        onClick={() => mapearProduto(p, '')}
                                      >
                                        ✖ Limpar (voltar a "Outros")
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="modal-rodape">
              <button className="btn-secondary" onClick={() => setDicaAberta(null)}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  // ===== Drill-down: mostra a lista de um grupo (com paginação) =====
  if (grupoAtivo) {
    const info = GRUPO_INFO[grupoAtivo.id] || {}
    const itens = grupoAtivo.itens || []
    const totalPaginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA))
    const paginaSegura = Math.min(pagina, totalPaginas)
    const inicio = (paginaSegura - 1) * POR_PAGINA
    const itensPagina = itens.slice(inicio, inicio + POR_PAGINA)
    const inicioExibicao = itens.length === 0 ? 0 : inicio + 1
    const fimExibicao = Math.min(inicio + POR_PAGINA, itens.length)
    return (
      <div className="painel">
        {aviso && <div className="toast-sucesso">{aviso}</div>}
        <div className="insights-head">
          <button className="btn-secondary" onClick={() => setGrupoAtivo(null)}>← Voltar</button>
          <h2>{info.icone} {info.titulo} <span className="insights-novas">({grupoAtivo.total})</span></h2>
          <button className="btn-secondary" onClick={carregar} title="Recarregar">🔄</button>
        </div>
        <p className="insights-descricao">{info.descricao}</p>
        {itens.length === 0 ? (
          <p className="empty">Nenhum item pendente nesta categoria.</p>
        ) : (
          <>
            <div className="dicas-contador">
              Mostrando <strong>{inicioExibicao}–{fimExibicao}</strong> de <strong>{itens.length}</strong> {itens.length === 1 ? 'item' : 'itens'}
            </div>
            <div className="insights-lista">
              {itensPagina.map((d) => {
                const chave = d.tipo + ':' + d.clienteId
                const processandoEsta = processando === chave
                const temDetalhe = Array.isArray(d.notasDetalhe) && d.notasDetalhe.length > 0
                return (
                  <div key={chave} className={'dica ' + (d.novo ? 'dica-nova' : '')}>
                    <div className="dica-cabecalho">
                      {usuario.admin && d.vendedorNome && <span className="dica-vendedor">👤 {d.vendedorNome}</span>}
                      <strong>[{d.codigo || d.clienteId}] {d.nome}</strong>
                      {d.ticketMedio > 0 && <span className="dica-valor">{fmtValor(d.ticketMedio)}</span>}
                      {d.novo && <span className="selo-novo">NOVO</span>}
                    </div>
                    <p>{d.texto}</p>
                    {d.ultimaCompra && <small className="dica-detalhe">ℹ️ Última compra: {d.ultimaCompra}</small>}
                    {temDetalhe && (
                      <button type="button" className="btn-detalhe" onClick={() => setDicaAberta(d)}>
                        🧾 Ver notas e produtos (últimos 3 meses)
                      </button>
                    )}
                    <div className="dica-acoes">
                      <button className="btn-acao" onClick={() => marcar('tratar', chave)} disabled={processandoEsta}>
                        {processandoEsta ? '...' : '✅ Tratar'}
                      </button>
                      <button className="btn-acao" onClick={() => marcar('adiar', chave)} disabled={processandoEsta}>
                        {processandoEsta ? '...' : '⏸️ Adiar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {totalPaginas > 1 && (
              <div className="dicas-paginacao">
                <button className="btn-secondary" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaSegura === 1}>
                  ‹ Anterior
                </button>
                <span className="dicas-pagina-info">Página {paginaSegura} de {totalPaginas}</span>
                <button className="btn-secondary" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaSegura === totalPaginas}>
                  Próxima ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }
  // ===== Visão principal: grid de cards =====
  return (
    <div className="painel">
      {aviso && <div className="toast-sucesso">{aviso}</div>}
      <div className="insights-head">
        <h2>🧠 Dicas Inteligentes</h2>
        <button className="btn-secondary" onClick={carregar} title="Recarregar dicas">🔄 Atualizar</button>
      </div>
      <div className="insights-resumo">
        <span>Vendas: {dados.resumo.totalVendas}</span>
        <span>Receita: {fmtValor(dados.resumo.receitaTotal)}</span>
        <span>Ticket médio: {fmtValor(dados.resumo.ticketMedio)}</span>
        <span>Oportunidades: {totalOportunidades}</span>
        {dados.resumo.novas > 0 && <span className="insights-novas">{dados.resumo.novas} novas</span>}
      </div>
      <div className="insights-grid">
        {dados.grupos.map((g) => {
          const info = GRUPO_INFO[g.id] || {}
          return (
            <button
              key={g.id}
              type="button"
              className={'insight-card insight-' + g.cor + (g.total > 0 ? '' : ' insight-vazio')}
              onClick={() => g.total > 0 && setGrupoAtivo(g)}
              title={info.descricao}
            >
              <div className="insight-card-topo">
                <span className="insight-icone">{info.icone}</span>
                <span className="insight-titulo">{info.titulo}</span>
              </div>
              <div className="insight-numero">{g.total}</div>
              {g.valorPotencial > 0 && (
                <div className="insight-valor">~{fmtValor(g.valorPotencial)}</div>
              )}
              <div className="insight-rodape">
                {g.total > 0 ? 'Ver lista →' : 'Sem pendências'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}