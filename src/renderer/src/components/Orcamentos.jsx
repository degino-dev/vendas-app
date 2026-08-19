import { useEffect, useMemo, useRef, useState } from 'react'
import { confirmar } from '../utils/confirmar'
import { fmtValor, fmtData, MESES_NOME, dataLocalISO, mascaraMoeda, moedaParaMascara, parseMoeda } from '../utils/format'
import { calcularMeta } from '../utils/financeiro'
const formVazio = () => ({
  clienteId: '',
  buscaCliente: '',
  envio: '',
  pedidoInsumos: '',
  valorInsumos: '',
  pedidoEquipamento: '',
  valorEquipamento: '',
  frete: '',
  data: dataLocalISO(),
  prazoValidade: '',
  observacao: ''
})
const STATUS_META = {
  aguardando: { label: '⏳ Aguardando', classe: 'status-aguardando' },
  aprovado: { label: '✅ Aprovado', classe: 'status-aprovado' },
  recusado: { label: '❌ Recusado', classe: 'status-recusado' }
}
export default function Orcamentos({ usuario }) {
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth() + 1
  const [orcamentos, setOrcamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [filtroAno, setFiltroAno] = useState(anoAtual)
  const [filtroMes, setFiltroMes] = useState(mesAtual)
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [form, setForm] = useState(formVazio())
  const [editando, setEditando] = useState(null)
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [erro, setErro] = useState('')
  // Modal de recusa
  const [recusando, setRecusando] = useState(null)
  const [recusaForm, setRecusaForm] = useState({ motivo: '', concorrente: '', observacao: '' })
  // Modal de aprovação (novos números de pedido + valor aprovado)
  // ===== ALTERADO: novo campo valorAprovado =====
  const [aprovando, setAprovando] = useState(null)
  const [aprovacaoForm, setAprovacaoForm] = useState({ pedidoInsumos: '', pedidoEquipamento: '', valorAprovado: '' })
  // ===== feedback de sucesso (toast) =====
  const [aviso, setAviso] = useState('')
  const avisoTimer = useRef(null)
  const mostrarAviso = (msg) => {
    setAviso(msg)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 3000)
  }
  useEffect(() => {
    const vendedorId = usuario.admin ? null : usuario.id
    window.api.listarOrcamentos(vendedorId).then(setOrcamentos)
    window.api.listarClientes(vendedorId).then(setClientes)
    if (usuario.admin) {
      window.api.listarVendedores().then(setVendedores)
    }
  }, [usuario])
  const clientePorId = (id) => clientes.find((c) => c.id === id)
  const vendedorPorId = (id) => vendedores.find((v) => v.id === id)
  const sugestoes = useMemo(() => {
    const busca = form.buscaCliente.trim().toLowerCase()
    if (!busca || form.clienteId) return []
    return [...clientes]
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
      .filter((c) => {
        const nome = c.nome.toLowerCase()
        const cod = String(c.codigo)
        return nome.includes(busca) || cod === busca || cod.startsWith(busca)
      })
      .slice(0, 8)
  }, [clientes, form.buscaCliente, form.clienteId])
  const anosDisponiveis = useMemo(() => {
    const set = new Set(orcamentos.map((o) => (o.data || '').slice(0, 4)))
    set.add(String(anoAtual))
    return [...set].sort().reverse()
  }, [orcamentos, anoAtual])
  const mesesDisponiveis = useMemo(() => {
    const set = new Set()
    for (const o of orcamentos) {
      const d = o.data || ''
      if (filtroAno === 'todos' || d.slice(0, 4) === String(filtroAno)) {
        const m = Number(d.slice(5, 7))
        if (m >= 1 && m <= 12) set.add(m)
      }
    }
    if (filtroAno === 'todos' || filtroAno === anoAtual) set.add(mesAtual)
    return [...set].sort((a, b) => a - b)
  }, [orcamentos, filtroAno, anoAtual, mesAtual])
  const orcamentosFiltrados = useMemo(() => {
    let lista = orcamentos
    if (filtroAno !== 'todos') {
      lista = lista.filter((o) => (o.data || '').slice(0, 4) === String(filtroAno))
    }
    if (filtroMes !== 'todos') {
      lista = lista.filter((o) => Number((o.data || '').slice(5, 7)) === filtroMes)
    }
    if (filtroVendedor !== 'todos') {
      lista = lista.filter((o) => o.vendedorId === filtroVendedor)
    }
    return lista
  }, [orcamentos, filtroAno, filtroMes, filtroVendedor])
  const ordenados = useMemo(() => {
    return [...orcamentosFiltrados].sort((a, b) => {
      const cmp = (b.data || '').localeCompare(a.data || '')
      if (cmp !== 0) return cmp
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
  }, [orcamentosFiltrados])
  const contadores = useMemo(() => ({
    aguardando: orcamentos.filter((o) => o.status === 'aguardando').length,
    aprovado: orcamentos.filter((o) => o.status === 'aprovado').length,
    recusado: orcamentos.filter((o) => o.status === 'recusado').length
  }), [orcamentos])
  // Total aguardando agora soma o VALOR DA META (pedido − frete)
  const totalAguardando = orcamentosFiltrados
    .filter((o) => o.status === 'aguardando')
    .reduce((soma, o) => soma + calcularMeta(o), 0)
  function escolherCliente(c) {
    setForm((f) => ({ ...f, clienteId: c.id, buscaCliente: '' }))
    setMostrarSugestoes(false)
  }
  function limparCliente() {
    setForm((f) => ({ ...f, clienteId: '', buscaCliente: '' }))
  }
  function abrirNovo() {
    setEditando(null)
    setErro('')
    setForm(formVazio())
  }
  function abrirEdicao(o) {
    setEditando(o)
    setErro('')
    setForm({
      clienteId: o.clienteId || '',
      buscaCliente: '',
      envio: o.envio || '',
      pedidoInsumos: o.pedidoInsumos || '',
      valorInsumos: o.valorInsumos != null ? moedaParaMascara(o.valorInsumos) : '',
      pedidoEquipamento: o.pedidoEquipamento || '',
      valorEquipamento: o.valorEquipamento != null ? moedaParaMascara(o.valorEquipamento) : '',
      frete: o.frete != null ? String(o.frete) : '',
      data: o.data || dataLocalISO(),
      prazoValidade: o.prazoValidade || '',
      observacao: o.observacao || ''
    })
  }
  function cancelarEdicao() {
    setEditando(null)
    setForm(formVazio())
  }
  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (!form.clienteId) {
      setErro('Selecione um cliente para o orçamento.')
      return
    }
    const payload = {
      clienteId: form.clienteId,
      envio: form.envio,
      pedidoInsumos: form.pedidoInsumos,
      valorInsumos: parseMoeda(form.valorInsumos),
      pedidoEquipamento: form.pedidoEquipamento,
      valorEquipamento: parseMoeda(form.valorEquipamento),
      frete: form.frete,
      data: form.data,
      prazoValidade: form.prazoValidade,
      observacao: form.observacao
    }
    if (editando) {
      const res = await window.api.atualizarOrcamento({ ...editando, ...payload })
      if (res.ok) {
        setOrcamentos((prev) => prev.map((x) => (x.id === editando.id ? { ...x, ...payload } : x)))
        cancelarEdicao()
        mostrarAviso('✅ Orçamento atualizado com sucesso!')
      } else {
        setErro(res.erro || 'Erro ao atualizar o orçamento.')
      }
    } else {
      const res = await window.api.criarOrcamento({
        ...payload,
        vendedorId: usuario.id,
        status: 'aguardando'
      })
      if (res.ok) {
        setOrcamentos((prev) => [res.orcamento, ...prev])
        setForm(formVazio())
        setMostrarSugestoes(false)
        mostrarAviso('✅ Orçamento registrado com sucesso!')
      } else {
        setErro(res.erro || 'Erro ao registrar o orçamento.')
      }
    }
  }
  // Abre o modal de aprovação pedindo o(s) novo(s) número(s) de pedido
  // ===== ALTERADO: reseta também o valorAprovado =====
  function abrirAprovacao(o) {
    setAprovando(o)
    setAprovacaoForm({ pedidoInsumos: '', pedidoEquipamento: '', valorAprovado: '' })
    setErro('')
  }
  async function confirmarAprovacao(e) {
    e.preventDefault()
    if (!aprovando) return
    const pi = aprovacaoForm.pedidoInsumos.trim()
    const pe = aprovacaoForm.pedidoEquipamento.trim()
    // Pelo menos um dos dois precisa ser preenchido
    if (!pi && !pe) {
      setErro('Informe ao menos o Ped. Insumos ou o Ped. Equip. para aprovar.')
      return
    }
    // ===== NOVO: converte o valor aprovado (máscara) para número; null = mantém o orçado =====
    const valorAprovadoNum = aprovacaoForm.valorAprovado ? parseMoeda(aprovacaoForm.valorAprovado) : null
    const res = await window.api.aprovarOrcamento(aprovando.id, {
      pedidoInsumos: pi,
      pedidoEquipamento: pe,
      valorAprovado: valorAprovadoNum
    })
    if (res.ok) {
      setOrcamentos((prev) =>
        prev.map((x) =>
          x.id === aprovando.id
            ? {
                ...x,
                status: 'aprovado',
                pedidoFinalInsumos: pi,
                pedidoFinalEquipamento: pe,
                // ===== NOVO: guarda o valor aprovado na lista local =====
                valorAprovado: valorAprovadoNum
              }
            : x
        )
      )
      setAprovando(null)
      mostrarAviso('✅ Orçamento aprovado e importado para Vendas!')
    } else {
      setErro(res.erro || 'Erro ao aprovar orçamento.')
      setAprovando(null)
    }
  }
  function abrirRecusa(o) {
    setRecusando(o)
    setRecusaForm({ motivo: '', concorrente: '', observacao: '' })
  }
  async function confirmarRecusa(e) {
    e.preventDefault()
    if (!recusando) return
    const res = await window.api.recusarOrcamento(recusando.id, recusaForm)
    if (res.ok) {
      setOrcamentos((prev) =>
        prev.map((x) =>
          x.id === recusando.id
            ? {
                ...x,
                status: 'recusado',
                motivo: recusaForm.motivo,
                concorrente: recusaForm.concorrente,
                observacaoRecusa: recusaForm.observacao
              }
            : x
        )
      )
      setRecusando(null)
      mostrarAviso('❌ Orçamento recusado.')
    } else {
      setErro(res.erro || 'Erro ao recusar orçamento.')
      setRecusando(null)
    }
  }
  async function deletar(o) {
    const confirmado = confirmar('Excluir este orçamento?')
    if (!confirmado) return
    await window.api.deletarOrcamento(o.id)
    setOrcamentos((prev) => prev.filter((x) => x.id !== o.id))
    mostrarAviso('🗑️ Orçamento excluído.')
  }
  return (
    <div className="orcamentos">
      {aviso && <div className="toast-sucesso">{aviso}</div>}
      <div className="section-head">
        <h2>Orçamentos</h2>
        <span className="total-badge">Total aguardando (Meta): {fmtValor(totalAguardando)}</span>
      </div>
      {/* Contadores no topo */}
      <div className="orcamento-contadores">
        <span className={'badge ' + STATUS_META.aguardando.classe}>⏳ Aguardando: {contadores.aguardando}</span>
        <span className={'badge ' + STATUS_META.aprovado.classe}>✅ Aprovados: {contadores.aprovado}</span>
        <span className={'badge ' + STATUS_META.recusado.classe}>❌ Recusados: {contadores.recusado}</span>
      </div>
      {/* Filtros */}
      <div className="filtros">
        <label>
          Ano
          <select
            value={filtroAno}
            onChange={(e) => setFiltroAno(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
          >
            <option value="todos">Todos</option>
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Mês
          <select
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
          >
            <option value="todos">Todos os meses</option>
            {mesesDisponiveis.map((m) => (
              <option key={m} value={m}>{MESES_NOME[m - 1]}</option>
            ))}
          </select>
        </label>
        {usuario.admin && (
          <label>
            Vendedor
            <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)}>
              <option value="todos">Todos</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {/* Formulário */}
      <form className="orcamento-form" onSubmit={salvar}>
        <div className="form-titulo-linha">
          <h3>{editando ? 'Editar Orçamento' : 'Novo Orçamento'}</h3>
          {erro && <p className="form-erro">{erro}</p>}
        </div>
        <div className="orcamento-form-grid">
          {/* LINHA 1 — Cliente, Envio, Data, Válido até */}
          <label className="campo-cliente">
            Cliente *
            <div className="cliente-busca">
              <input
                value={form.clienteId ? (clientePorId(form.clienteId)?.nome || '') : form.buscaCliente}
                onChange={(e) => {
                  setForm((f) => ({ ...f, buscaCliente: e.target.value, clienteId: '' }))
                  setMostrarSugestoes(true)
                }}
                onFocus={() => setMostrarSugestoes(true)}
                onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
                placeholder="Digite o nome ou ID do cliente..."
              />
              {form.clienteId && (
                <button type="button" className="btn-limpar" onClick={limparCliente}>✕</button>
              )}
              {mostrarSugestoes && sugestoes.length > 0 && (
                <div className="sugestoes">
                  {sugestoes.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        escolherCliente(c)
                      }}
                    >
                      <span>#{c.codigo} {c.nome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </label>
          <label>
            Envio
            <select
              value={form.envio}
              onChange={(e) => setForm({ ...form, envio: e.target.value })}
              required
            >
              <option value="">Selecione o meio de envio</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="E-mail">E-mail</option>
              <option value="Telefone">Telefone</option>
              <option value="Teams">Teams</option>
              <option value="Plataforma">Plataforma</option>
            </select>
          </label>
          <label>
            Data
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
          </label>
          <label>
            Válido até
            <input
              type="date"
              value={form.prazoValidade}
              onChange={(e) => setForm({ ...form, prazoValidade: e.target.value })}
            />
          </label>
          {/* LINHA 2 — Orçamentos e valores */}
          <label>
            Orc. Insumos
            <input
              value={form.pedidoInsumos}
              onChange={(e) => setForm({ ...form, pedidoInsumos: e.target.value })}
              placeholder="Nº do orçamento de insumos"
            />
          </label>
          <label>
            Valor Insumos
            <input
              inputMode="decimal"
              value={form.valorInsumos}
              onChange={(e) => setForm({ ...form, valorInsumos: mascaraMoeda(e.target.value) })}
              placeholder="0,00"
            />
          </label>
          <label>
            Orc. Equip.
            <input
              value={form.pedidoEquipamento}
              onChange={(e) => setForm({ ...form, pedidoEquipamento: e.target.value })}
              placeholder="Nº do orçamento de equipamento"
            />
          </label>
          <label>
            Valor Equip.
            <input
              inputMode="decimal"
              value={form.valorEquipamento}
              onChange={(e) => setForm({ ...form, valorEquipamento: mascaraMoeda(e.target.value) })}
              placeholder="0,00"
            />
          </label>
          <label>
            Frete
            <input
              value={form.frete}
              onChange={(e) => setForm({ ...form, frete: e.target.value })}
              placeholder="0,00 ou 10%"
              title="Valor fixo (ex: 79,90) ou porcentagem do pedido (ex: 10%)"
            />
          </label>
          {/* OBSERVAÇÃO — largura total */}
          <label className="obs-label">
            Observação
            <input
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </label>
          {/* BOTÕES */}
          <div className="orcamento-form-acoes">
            <button type="submit" className="btn-primary">
              {editando ? 'Salvar Alterações' : 'Registrar Orçamento'}
            </button>
            {editando && (
              <button type="button" className="btn-secondary" onClick={cancelarEdicao}>Cancelar</button>
            )}
            {!editando && (
              <button type="button" className="btn-secondary" onClick={abrirNovo}>Limpar</button>
            )}
          </div>
        </div>
      </form>
      {/* Tabela */}
      {ordenados.length === 0 ? (
        <p className="empty">Nenhum orçamento encontrado.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                {usuario.admin && <th>Vendedor</th>}
                <th>Envio</th>
                <th>Insumos</th>
                <th>Equip.</th>
                <th>Frete</th>
                <th>Valor Ped.</th>
                <th>Data</th>
                <th>Válido até</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((o) => {
                const cli = clientePorId(o.clienteId)
                const vend = vendedorPorId(o.vendedorId)
                const status = o.status || 'aguardando'
                const st = STATUS_META[status] || STATUS_META.aguardando
                // Infos extras de aprovação/recusa (movidas para a observação)
                const infosExtras = []
                if (o.status === 'aprovado') {
                  if (o.pedidoFinalInsumos) infosExtras.push('Ped. Insumos: ' + o.pedidoFinalInsumos)
                  if (o.pedidoFinalEquipamento) infosExtras.push('Ped. Equip.: ' + o.pedidoFinalEquipamento)
                }
                if (o.status === 'recusado') {
                  if (o.motivo) infosExtras.push('Motivo: ' + o.motivo)
                  if (o.concorrente) infosExtras.push('Concorrente: ' + o.concorrente)
                  if (o.observacaoRecusa) infosExtras.push('Obs: ' + o.observacaoRecusa)
                }
                return (
                  <tr key={o.id} className={'orc-status-' + status}>
                    <td className="rank">{cli ? cli.codigo : '-'}</td>
                    <td>
                      <span className="orc-ponto" title={st.label} />
                      {cli ? cli.nome : '(cliente removido)'}
                    </td>
                    {usuario.admin && <td>{vend ? vend.nome : '-'}</td>}
                    <td>{o.envio || '—'}</td>
                    <td className="venda-grupo">
                      {o.pedidoInsumos && <span className="venda-desc">{o.pedidoInsumos}</span>}
                      <span className="venda-valor">{fmtValor(o.valorInsumos)}</span>
                    </td>
                    <td className="venda-grupo">
                      {o.pedidoEquipamento && <span className="venda-desc">{o.pedidoEquipamento}</span>}
                      <span className="venda-valor">{fmtValor(o.valorEquipamento)}</span>
                    </td>
                    <td>{o.frete ? (String(o.frete).includes('%') ? o.frete : fmtValor(String(o.frete).replace(',', '.'))) : '—'}</td>
                    {/* ===== ALTERADO: mostra Orçado vs Aprovado quando houver valor aprovado ===== */}
                    <td className="valor-meta">
                      {o.status === 'aprovado' && o.valorAprovado != null ? (
                        <>
                          <span className="venda-desc">Orçado: {fmtValor((Number(o.valorInsumos) || 0) + (Number(o.valorEquipamento) || 0))}</span>
                          <span className="venda-valor">Aprovado: {fmtValor(o.valorAprovado)}</span>
                        </>
                      ) : (
                        fmtValor(calcularMeta(o))
                      )}
                    </td>
                    <td>{fmtData(o.data)}</td>
                    <td>{fmtData(o.prazoValidade) || '—'}</td>
                    <td className="acoes">
                      {o.status === 'aguardando' && (
                        <>
                          <button className="btn-acao" onClick={() => abrirEdicao(o)} title="Editar orçamento">✏️</button>
                          <button className="btn-acao btn-acao-ok" onClick={() => abrirAprovacao(o)} title="Aprovar (importar para Vendas)">✅</button>
                          <button className="btn-acao btn-acao-danger" onClick={() => abrirRecusa(o)} title="Recusar orçamento">❌</button>
                        </>
                      )}
                      <button className="btn-acao btn-acao-danger" onClick={() => deletar(o)} title="Excluir orçamento">🗑️</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Modal de aprovação — pede número(s) de pedido + VALOR APROVADO */}
      {aprovando && (
        <div className="modal-overlay" onClick={() => setAprovando(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Aprovar Orçamento</h3>
            <p className="modal-sub">
              {clientePorId(aprovando.clienteId)?.nome || '(cliente)'} · Orçado: {fmtValor((Number(aprovando.valorInsumos) || 0) + (Number(aprovando.valorEquipamento) || 0))}
            </p>
            <p className="modal-info">
              Informe o número do pedido de insumos <strong>e/ou</strong> de equipamento que será importado para a aba <strong>Vendas</strong>. Preencha <strong>ao menos um</strong> dos dois.
            </p>
            <p className="modal-info">
              Se o cliente aprovou por um <strong>valor diferente</strong> do orçado, preencha o <strong>Valor aprovado</strong>. Se deixar vazio, mantém o valor do orçamento.
            </p>
            <form onSubmit={confirmarAprovacao}>
              <label>
                Ped. Insumos
                <input
                  value={aprovacaoForm.pedidoInsumos}
                  onChange={(e) => setAprovacaoForm({ ...aprovacaoForm, pedidoInsumos: e.target.value })}
                  placeholder="Número do pedido de insumos"
                  autoFocus
                />
              </label>
              <label>
                Ped. Equip.
                <input
                  value={aprovacaoForm.pedidoEquipamento}
                  onChange={(e) => setAprovacaoForm({ ...aprovacaoForm, pedidoEquipamento: e.target.value })}
                  placeholder="Número do pedido de equipamento"
                />
              </label>
              {/* ===== NOVO: campo Valor aprovado ===== */}
              <label>
                Valor aprovado (R$)
                <input
                  inputMode="decimal"
                  value={aprovacaoForm.valorAprovado}
                  onChange={(e) => setAprovacaoForm({ ...aprovacaoForm, valorAprovado: mascaraMoeda(e.target.value) })}
                  placeholder="0,00 — vazio = mantém o orçado"
                  title="Se o cliente aprovou por um valor diferente do orçado, informe aqui"
                />
              </label>
              {erro && <p className="form-erro">{erro}</p>}
              <div className="modal-acoes">
                <button type="button" className="btn-secondary" onClick={() => setAprovando(null)}>Cancelar</button>
                <button type="submit" className="btn-primary">Confirmar Aprovação</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de recusa */}
      {recusando && (
        <div className="modal-overlay" onClick={() => setRecusando(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Recusar Orçamento</h3>
            <p className="modal-sub">
              {clientePorId(recusando.clienteId)?.nome || '(cliente)'} · {fmtValor(Number(recusando.valorInsumos) + Number(recusando.valorEquipamento))}
            </p>
            <form onSubmit={confirmarRecusa}>
              <label>
                Motivo da recusa
                <input
                  value={recusaForm.motivo}
                  onChange={(e) => setRecusaForm({ ...recusaForm, motivo: e.target.value })}
                  placeholder="Ex.: preço acima do orçamento do cliente"
                  autoFocus
                />
              </label>
              <label>
                Concorrente
                <input
                  value={recusaForm.concorrente}
                  onChange={(e) => setRecusaForm({ ...recusaForm, concorrente: e.target.value })}
                  placeholder="Concorrente que ganhou (se houver)"
                />
              </label>
              <label>
                Observação
                <textarea
                  value={recusaForm.observacao}
                  onChange={(e) => setRecusaForm({ ...recusaForm, observacao: e.target.value })}
                  placeholder="Detalhes adicionais"
                  rows={3}
                />
              </label>
              <div className="modal-acoes">
                <button type="button" className="btn-secondary" onClick={() => setRecusando(null)}>Cancelar</button>
                <button type="submit" className="btn-danger">Confirmar Recusa</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}