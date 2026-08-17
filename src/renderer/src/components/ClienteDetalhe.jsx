import { useEffect, useRef, useState } from 'react'
import { fmtMoeda, fmtCnpj, fmtFone, fmtDataHora, fmtData } from '../utils/format'
// ===== NOVO: componente de Rotina do Laboratório =====
import RotinaLaboratorio from './RotinaLaboratorio'
const ROTULOS_TIPO = {
  ligacao: '📞 Liguei',
  promocao: '🎁 Promoção',
  visita: '📅 Visita agendada',
  proposta: '📄 Proposta',
  obs: '📝 Observação'
}
const STATUS_ORC = {
  aprovado: { label: '✅ Aprovado', classe: 'status-aprovado' },
  recusado: { label: '❌ Recusado', classe: 'status-recusado' }
}
export default function ClienteDetalhe({ clienteId, onVoltar }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [historico, setHistorico] = useState([])
  const [novoTipo, setNovoTipo] = useState('obs')
  const [novaDesc, setNovaDesc] = useState('')
  const [salvando, setSalvando] = useState(false)
  // ===== NOVO: feedback de sucesso (toast) =====
  const [aviso, setAviso] = useState('')
  const avisoTimer = useRef(null)
  const mostrarAviso = (msg) => {
    setAviso(msg)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 3000)
  }
  // Top produtos (notas.json)
  const [maisComprados, setMaisComprados] = useState([])
  const [menosComprados, setMenosComprados] = useState([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(false)
  const [erroProdutos, setErroProdutos] = useState('')
  // ===== NOVO: filtro de ano das notas (total / 2025 / 2026) =====
  const [anoFiltro, setAnoFiltro] = useState('total')
  const [anosDisponiveis, setAnosDisponiveis] = useState([])
  // Orçamentos aprovados e recusados
  const [orcamentos, setOrcamentos] = useState([])
  const [carregandoOrc, setCarregandoOrc] = useState(false)
  // ===== NOVO: Rotina do Laboratório (dados do cliente + notas para o alerta) =====
  const [rotinaCliente, setRotinaCliente] = useState(null)
  const [comprasNotas, setComprasNotas] = useState([])
  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro('')
    if (!window.api || typeof window.api.estatisticasCliente !== 'function') {
      setErro('Função de estatísticas não disponível. Verifique o preload/index.js.')
      setCarregando(false)
      return
    }
    window.api
      .estatisticasCliente(clienteId)
      .then((res) => {
        if (!ativo) return
        setDados(res)
        setCarregando(false)
      })
      .catch((err) => {
        if (!ativo) return
        console.error('Erro ao carregar estatísticas:', err)
        setErro('Falha ao carregar as estatísticas do cliente.')
        setCarregando(false)
      })
    return () => { ativo = false }
  }, [clienteId])
  // ===== NOVO: prepara o cliente para a rotina quando os dados carregam =====
  useEffect(() => {
    if (dados && dados.ok && dados.cliente) {
      setRotinaCliente(dados.cliente)
    }
  }, [dados])
  // ===== NOVO: carrega as notas fiscais do cliente para o alerta de consumo =====
  useEffect(() => {
    if (!rotinaCliente || !rotinaCliente.id) {
      setComprasNotas([])
      return
    }
    if (!window.api || typeof window.api.comprasNotas !== 'function') {
      setComprasNotas([])
      return
    }
    window.api.comprasNotas(rotinaCliente.id)
      .then((res) => setComprasNotas(res && res.ok ? res.itens : []))
      .catch(() => setComprasNotas([]))
  }, [rotinaCliente])
  // Carrega o histórico automaticamente (sempre visível)
  useEffect(() => {
    if (!window.api || typeof window.api.historicoCliente !== 'function') {
      setHistorico([])
      return
    }
    window.api
      .historicoCliente(clienteId)
      .then((res) => setHistorico(Array.isArray(res) ? res : []))
      .catch((err) => { console.error('Erro ao carregar histórico:', err); setHistorico([]) })
  }, [clienteId])
  // ===== ALTERADO: carrega o Top de produtos passando o ano filtrado =====
  useEffect(() => {
    if (!dados || !dados.ok || !dados.cliente || !dados.cliente.codigo) return
    const codigo = String(dados.cliente.codigo)
    if (!window.api || typeof window.api.notasTopCliente !== 'function') {
      setErroProdutos('Função de notas não disponível. Verifique o preload/index.js.')
      return
    }
    setCarregandoProdutos(true)
    setErroProdutos('')
    window.api
      .notasTopCliente(codigo, anoFiltro)
      .then((res) => {
        if (res && res.ok) {
          setMaisComprados(res.maisComprados || [])
          setMenosComprados(res.menosComprados || [])
        } else {
          setErroProdutos((res && res.erro) || 'Sem dados de notas para este cliente.')
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar top produtos:', err)
        setErroProdutos('Falha ao carregar os produtos do notas.json.')
      })
      .finally(() => setCarregandoProdutos(false))
  }, [dados, anoFiltro])
  // Carrega os anos disponíveis nas notas (seletor dinâmico)
  useEffect(() => {
    if (!window.api || typeof window.api.notasAnos !== 'function') return
    window.api
      .notasAnos()
      .then((res) => {
        if (res && res.ok) setAnosDisponiveis(res.anos || [])
      })
      .catch((err) => console.error('Erro ao carregar anos das notas:', err))
  }, [])
  // Carrega orçamentos aprovados e recusados deste cliente
  useEffect(() => {
    if (!window.api || typeof window.api.listarOrcamentos !== 'function') return
    setCarregandoOrc(true)
    window.api
      .listarOrcamentos()
      .then((lista) => {
        const arr = Array.isArray(lista) ? lista : []
        const doCliente = arr.filter(
          (o) => o.clienteId === clienteId && (o.status === 'aprovado' || o.status === 'recusado')
        )
        setOrcamentos(doCliente)
      })
      .catch((err) => { console.error('Erro ao carregar orçamentos:', err); setOrcamentos([]) })
      .finally(() => setCarregandoOrc(false))
  }, [clienteId])
  const adicionarHistorico = () => {
    const desc = novaDesc.trim()
    if (!desc) return
    if (!window.api || typeof window.api.salvarHistorico !== 'function') {
      setErro('Função de histórico não disponível. Verifique o preload/index.js.')
      return
    }
    setSalvando(true)
    window.api
      .salvarHistorico(clienteId, { tipo: novoTipo, descricao: desc })
      .then(() => {
        setNovaDesc('')
        // ===== NOVO: feedback de sucesso =====
        mostrarAviso('✅ Interação registrada!')
        return window.api.historicoCliente(clienteId)
      })
      .then((res) => setHistorico(Array.isArray(res) ? res : []))
      .catch((err) => { console.error('Erro ao salvar histórico:', err); setErro('Falha ao salvar a interação.') })
      .finally(() => setSalvando(false))
  }
  if (carregando) {
    return (
      <div className="painel">
        <div className="cliente-detalhe-topo">
          <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        </div>
        <p className="empty">Carregando estatísticas...</p>
      </div>
    )
  }
  if (erro) {
    return (
      <div className="painel">
        <div className="cliente-detalhe-topo">
          <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        </div>
        <h2>Estatísticas do cliente</h2>
        <p className="form-erro">{erro}</p>
      </div>
    )
  }
  if (!dados || !dados.ok) {
    return (
      <div className="painel">
        <div className="cliente-detalhe-topo">
          <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        </div>
        <h2>Estatísticas do cliente</h2>
        <p className="empty">Cliente não encontrado.</p>
      </div>
    )
  }
  const c = dados.cliente
  const e = dados.estatisticas
  const saudeMeta = {
    novo: { label: '🆕 Novo', classe: 'saude-novo' },
    ativo: { label: '✅ Ativo', classe: 'saude-ativo' },
    atencao: { label: '⚠️ Atenção', classe: 'saude-atencao' },
    risco: { label: '🔴 Risco', classe: 'saude-risco' }
  }
  const saude = saudeMeta[e.saude] || { label: e.saude || '—', classe: '' }
  // ===== NOVO: sugestão de próxima ação baseada na saúde do cliente =====
  const proximaAcao = () => {
    if (e.saude === 'risco') {
      return { texto: `Cliente em risco há ${e.diasDesdeUltima ?? '?'} dias sem comprar. Ligue hoje para reativar.`, classe: 'acao-risco' }
    }
    if (e.saude === 'atencao') {
      return { texto: 'Cliente com atenção: faça um contato de acompanhamento esta semana.', classe: 'acao-atencao' }
    }
    if (e.saude === 'novo') {
      return { texto: 'Cliente novo: agende um follow-up para apresentar mais produtos.', classe: 'acao-novo' }
    }
    return { texto: 'Cliente ativo: aproveite para oferecer cross-sell dos produtos menos recorrentes.', classe: 'acao-ativo' }
  }
  const acao = proximaAcao()
  return (
    <div className="painel">
      {/* ===== NOVO: toast de sucesso ===== */}
      {aviso && <div className="toast-sucesso">{aviso}</div>}
      <div className="cliente-detalhe-topo">
        <button className="btn-voltar" onClick={onVoltar}>← Voltar</button>
        <div className="cliente-badges">
          <span className={'badge ' + saude.classe}>{saude.label}</span>
          <span className={'badge badge-abc abc-' + e.classeAbc}>Curva {e.classeAbc}</span>
        </div>
      </div>
      <h2 className="cliente-titulo">{c.nome}</h2>
      {/* ===== NOVO: sugestão de próxima ação ===== */}
      <div className={'proxima-acao ' + acao.classe}>
        🎯 <strong>Próxima ação:</strong> {acao.texto}
      </div>
      {/* Dados cadastrais */}
      <div className="cliente-info-grid">
        {c.codigo && <div className="info-card"><span className="info-label">ID</span><span>{c.codigo}</span></div>}
        {c.cnpj && <div className="info-card"><span className="info-label">CNPJ</span><span>{fmtCnpj(c.cnpj)}</span></div>}
        {c.email && (
          <div className="info-card">
            <span className="info-label">E-mail</span>
            {/* ===== NOVO: e-mail clicável ===== */}
            <a href={`mailto:${c.email}`} className="info-link">{c.email}</a>
          </div>
        )}
        {c.whats && <div className="info-card"><span className="info-label">WhatsApp</span><span>{fmtFone(c.whats)}</span></div>}
        {c.cidade && <div className="info-card"><span className="info-label">Cidade</span><span>{c.cidade}</span></div>}
        {c.segmento && <div className="info-card"><span className="info-label">Segmento</span><span>{c.segmento}</span></div>}
      </div>
      {/* Indicadores */}
      <div className="stats-grid">
        <div className="stat-card"><strong>{e.totalVendas}</strong><span>Vendas</span></div>
        <div className="stat-card stat-destaque"><strong>{fmtMoeda(e.totalGasto)}</strong><span>Total gasto</span></div>
        <div className="stat-card"><strong>{fmtMoeda(e.ticketMedio)}</strong><span>Ticket médio</span></div>
        <div className="stat-card"><strong>{e.intervaloDias ? e.intervaloDias + ' dias' : '—'}</strong><span>Frequência média</span></div>
        <div className="stat-card"><strong>{e.frequenciaMensal ? e.frequenciaMensal + '/mês' : '—'}</strong><span>Compras/mês</span></div>
        <div className="stat-card"><strong>{e.diaComum || '—'}</strong><span>Dia mais comum</span></div>
        <div className="stat-card stat-destaque"><strong>{e.diasDesdeUltima != null ? e.diasDesdeUltima + ' dias' : '—'}</strong><span>Desde última compra</span></div>
        <div className="stat-card"><strong>{fmtMoeda(e.totalAnoAtual)}</strong><span>Total no ano ({new Date().getFullYear()})</span></div>
      </div>
      {e.variacaoAnual !== null && (
        <div className={'variacao ' + (e.variacaoAnual >= 0 ? 'variacao-ok' : 'variacao-ruim')}>
          {e.variacaoAnual >= 0 ? '▲' : '▼'} {Math.abs(e.variacaoAnual)}% vs ano anterior
        </div>
      )}
      <div className="cliente-secao">
        <h3>Últimas compras</h3>
        {e.ultimasCompras.length === 0 ? (
          <p className="empty">Nenhuma venda registrada para este cliente.</p>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Data</th><th>Insumos</th><th>Equipamento</th><th>Valor</th></tr>
              </thead>
              <tbody>
                {e.ultimasCompras.map((v, i) => (
                  <tr key={i}>
                    {/* ===== NOVO: usa fmtData (consistente) ===== */}
                    <td>{fmtData(v.data)}</td>
                    <td>{v.insumos || '—'}</td>
                    <td>{v.equipamento || '—'}</td>
                    <td>{fmtMoeda(v.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Orçamentos aprovados e recusados */}
      <div className="cliente-secao">
        <h3>📋 Orçamentos aprovados e recusados</h3>
        {carregandoOrc ? (
          <p className="empty">Carregando orçamentos...</p>
        ) : orcamentos.length === 0 ? (
          <p className="empty">Nenhum orçamento aprovado ou recusado para este cliente.</p>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Envio</th>
                  <th>Insumos</th>
                  <th>Valor Insumos</th>
                  <th>Equip.</th>
                  <th>Valor Equip.</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orcamentos
                  .slice()
                  .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
                  .map((o) => {
                    const st = STATUS_ORC[o.status] || { label: o.status, classe: '' }
                    return (
                      <tr key={o.id} className={'orc-status-' + o.status}>
                        <td>{fmtData(o.data)}</td>
                        <td>{o.envio || '—'}</td>
                        <td>{o.pedidoInsumos || '—'}</td>
                        <td>{fmtMoeda(o.valorInsumos)}</td>
                        <td>{o.pedidoEquipamento || '—'}</td>
                        <td>{fmtMoeda(o.valorEquipamento)}</td>
                        <td>
                          <span className={'badge ' + st.classe}>{st.label}</span>
                          {o.status === 'recusado' && o.motivo && (
                            <div className="recusa-info">Motivo: {o.motivo}</div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ===== NOVO: filtro de ano das notas ===== */}
      <div className="cliente-secao">
        <div className="top-filtro-ano">
          <label>Período das notas:</label>
          <select value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)}>
            <option value="total">Total (todos os anos)</option>
            {anosDisponiveis.map((ano) => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Top produtos (notas.json) */}
      <div className="cliente-secao">
        <h3>📊 Produtos mais comprados</h3>
        {carregandoProdutos ? (
          <p className="empty">Carregando produtos...</p>
        ) : erroProdutos ? (
          <p className="form-erro">{erroProdutos}</p>
        ) : maisComprados.length === 0 ? (
          <p className="empty">Nenhum produto encontrado no notas.json para este cliente.</p>
        ) : (
          <ol className="top-lista">
            {maisComprados.map((p, i) => (
              <li key={p.codigo}>
                <span className="top-pos">{i + 1}</span>
                <span className="top-desc">{p.descricao}</span>
                <span className="top-qtd">{p.quantidade} {p.unidade}</span>
                <span className="top-valor">{fmtMoeda(p.valor)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="cliente-secao">
        <h3>📉 Produtos menos recorrentes</h3>
        {carregandoProdutos ? (
          <p className="empty">Carregando produtos...</p>
        ) : erroProdutos ? (
          <p className="form-erro">{erroProdutos}</p>
        ) : menosComprados.length === 0 ? (
          <p className="empty">Nenhum produto encontrado no notas.json para este cliente.</p>
        ) : (
          <ol className="top-lista">
            {menosComprados.map((p, i) => (
              <li key={p.codigo}>
                <span className="top-pos">{i + 1}</span>
                <span className="top-desc">{p.descricao}</span>
                <span className="top-qtd">{p.aparicoes} aparições · {p.quantidade} {p.unidade}</span>
                <span className="top-valor">{fmtMoeda(p.valor)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {/* Histórico de interações — sempre visível */}
      <div className="cliente-secao historico-secao">
        <h3>📋 Histórico de Interações</h3>
        <div className="historico-form">
          <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)}>
            <option value="ligacao">📞 Liguei</option>
            <option value="promocao">🎁 Enviei promoção</option>
            <option value="visita">📅 Agendei visita</option>
            <option value="proposta">📄 Enviei proposta</option>
            <option value="obs">📝 Observação</option>
          </select>
          <input
            value={novaDesc}
            onChange={(e) => setNovaDesc(e.target.value)}
            placeholder="O que aconteceu com o cliente?"
            onKeyDown={(e) => e.key === 'Enter' && adicionarHistorico()}
          />
          <button onClick={adicionarHistorico} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
        {historico.length === 0 ? (
          <p className="empty">Nenhuma interação registrada ainda.</p>
        ) : (
          <ul className="historico-lista">
            {historico.slice().reverse().map((item, i) => (
              <li key={i}>
                <strong>{fmtDataHora(item.data)}</strong> · {ROTULOS_TIPO[item.tipo] || item.tipo} — {item.descricao}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* ===== NOVO: Rotina do Laboratório (movida para o FINAL, após o Histórico) ===== */}
      <div className="cliente-secao">
        <RotinaLaboratorio
          inline
          cliente={rotinaCliente || c}
          comprasNotas={comprasNotas}
          onSalvar={async ({ rotinas, equipamentos }) => {
            const atualizado = { ...(rotinaCliente || c), rotinas, equipamentos }
            const res = await window.api.atualizarCliente(atualizado)
            if (res && res.ok) {
              setDados((prev) => (prev && prev.ok ? { ...prev, cliente: atualizado } : prev))
              setRotinaCliente(atualizado)
              mostrarAviso('🧪 Rotina do laboratório salva!')
            } else {
              mostrarAviso('⚠️ Erro ao salvar a rotina.')
            }
          }}
        />
      </div>
    </div>
  )
}