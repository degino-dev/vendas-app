import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtValor } from '../utils/format'
// Rótulo e ícone de cada tipo de dica (clareza imediata)
const TIPO_INFO = {
  risco: { label: '⚠️ Em risco', classe: 'dica-risco' },
  momento: { label: '🎯 Momento de compra', classe: 'dica-momento' },
  padrao: { label: '📊 Padrão', classe: 'dica-padrao' },
  cross: { label: '🔗 Cross-sell', classe: 'dica-cross' },
  ranking: { label: '🏆 Ranking', classe: 'dica-ranking' },
  sazonal: { label: '📅 Sazonal', classe: 'dica-sazonal' }
}
export default function Insights({ usuario }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  // ===== feedback de sucesso (toast) =====
  const [aviso, setAviso] = useState('')
  const avisoTimer = useRef(null)
  const mostrarAviso = (msg) => {
    setAviso(msg)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 3000)
  }
  // ===== filtro por tipo de dica =====
  const [filtroTipo, setFiltroTipo] = useState(null)
  // ===== controle de qual ação está processando =====
  const [processando, setProcessando] = useState('')
  function carregar() {
    setCarregando(true)
    setErro('')
    window.api
      .gerarInsights()
      .then((res) => {
        setDados(res)
        // ===== marca as dicas como vistas ao abrir =====
        if (res && res.dicas) {
          for (const d of res.dicas) {
            if (d.novo) {
              window.api.marcarInsight({ acao: 'ver', chave: d.tipo + ':' + d.clienteId })
            }
          }
        }
      })
      .catch(() => {
        setErro('Não foi possível carregar as dicas. Tente novamente.')
      })
      .finally(() => {
        setCarregando(false)
      })
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
  // ===== contagem por tipo (para o filtro e resumo) =====
  const contagemTipos = useMemo(() => {
    const cont = { risco: 0, momento: 0, padrao: 0, cross: 0, ranking: 0, sazonal: 0 }
    if (dados && dados.dicas) {
      for (const d of dados.dicas) {
        if (cont[d.tipo] !== undefined) cont[d.tipo]++
      }
    }
    return cont
  }, [dados])
  // ===== dicas filtradas por tipo =====
  const dicasFiltradas = useMemo(() => {
    if (!dados || !dados.dicas) return []
    if (!filtroTipo) return dados.dicas
    return dados.dicas.filter((d) => d.tipo === filtroTipo)
  }, [dados, filtroTipo])
  if (carregando) {
    return (
      <div className="painel">
        <h2>💡 Dicas do dia</h2>
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
        <h2>💡 Dicas do dia</h2>
        <p className="form-erro">{erro}</p>
        <button className="btn-primary" onClick={carregar}>🔄 Tentar novamente</button>
      </div>
    )
  }
  if (!dados || !dados.dicas || dados.dicas.length === 0) {
    return (
      <div className="painel">
        <h2>💡 Dicas do dia</h2>
        <p>Nenhuma dica pendente no momento. Novas sugestões aparecem aqui conforme os padrões de compra dos seus clientes se formam.</p>
        <button className="btn-secondary" onClick={carregar}>🔄 Atualizar</button>
      </div>
    )
  }
  const tipoClasse = {
    risco: 'dica-risco',
    momento: 'dica-momento',
    padrao: 'dica-padrao',
    cross: 'dica-cross',
    ranking: 'dica-ranking',
    sazonal: 'dica-sazonal'
  }
  return (
    <div className="painel">
      {aviso && <div className="toast-sucesso">{aviso}</div>}
      <div className="insights-head">
        <h2>💡 Dicas do dia</h2>
        <button className="btn-secondary" onClick={carregar} title="Recarregar dicas">🔄 Atualizar</button>
      </div>
      <div className="insights-resumo">
        <span>Vendas: {dados.resumo.totalVendas}</span>
        <span>Receita: {fmtValor(dados.resumo.receitaTotal)}</span>
        <span>Ticket médio: {fmtValor(dados.resumo.ticketMedio)}</span>
        <span>Clientes em risco: {dados.resumo.clientesEmRisco}</span>
        {dados.resumo.novas > 0 && <span className="insights-novas">{dados.resumo.novas} novas</span>}
      </div>
      {/* filtro por tipo de dica */}
      <div className="insights-filtros">
        <button
          className={'insights-filtro ' + (filtroTipo === null ? 'ativo' : '')}
          onClick={() => setFiltroTipo(null)}
        >
          Todas ({dados.dicas.length})
        </button>
        {Object.keys(contagemTipos).map((t) => (
          <button
            key={t}
            className={'insights-filtro ' + (filtroTipo === t ? 'ativo' : '')}
            onClick={() => setFiltroTipo(filtroTipo === t ? null : t)}
          >
            {TIPO_INFO[t].label} ({contagemTipos[t]})
          </button>
        ))}
      </div>
      <div className="insights-lista">
        {dicasFiltradas.map((d) => {
          const info = TIPO_INFO[d.tipo] || { label: d.tipo, classe: '' }
          const chave = d.tipo + ':' + d.clienteId
          const processandoEsta = processando === chave
          return (
            <div key={chave} className={'dica ' + (tipoClasse[d.tipo] || '') + (d.novo ? ' dica-nova' : '')}>
              <div className="dica-cabecalho">
                {usuario.admin && d.vendedorNome && <span className="dica-vendedor">👤 {d.vendedorNome}</span>}
                <span className={'dica-tag ' + (tipoClasse[d.tipo] || '')}>{info.label}</span>
                <strong>{d.titulo}</strong>
                {d.novo && <span className="selo-novo">NOVO</span>}
              </div>
              <p>{d.texto}</p>
              {d.detalhe && <small className="dica-detalhe">ℹ️ {d.detalhe}</small>}
              <div className="dica-acoes">
                <button
                  className="btn-acao"
                  onClick={() => marcar('tratar', chave)}
                  disabled={processandoEsta}
                >
                  {processandoEsta ? '...' : '✅ Tratar'}
                </button>
                <button
                  className="btn-acao"
                  onClick={() => marcar('adiar', chave)}
                  disabled={processandoEsta}
                >
                  {processandoEsta ? '...' : '⏸️ Adiar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}