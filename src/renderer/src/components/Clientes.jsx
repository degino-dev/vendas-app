import { useEffect, useMemo, useRef, useState } from 'react'
import { confirmar } from '../utils/confirmar'
import { fmtData, fmtDataHora as fmtDataHoraHist, parseData, fmtCnpj } from '../utils/format'
import ClienteDetalhe from './ClienteDetalhe'
const ROTULO_STATUS = {
  'ativo': 'Ativo',
  'atencao': 'Atenção',
  'inativo': 'Inativo',
  'sem-compra': 'Sem compras'
}
const ROTULOS_TIPO_HIST = {
  ligacao: '📞 Liguei',
  promocao: '🎁 Promoção',
  visita: '📅 Visita agendada',
  proposta: '📄 Proposta',
  obs: '📝 Observação'
}
const formVazio = () => ({
  codigo: '', nome: '', cnpj: '', email: '', whats: '', contato: '', cidade: '', segmento: ''
})
function Clientes({ usuario }) {
  const [clientes, setClientes] = useState([])
  const [vendas, setVendas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [cidades, setCidades] = useState([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(formVazio())
  const [buscaCidade, setBuscaCidade] = useState('')
  const [mostrarCidades, setMostrarCidades] = useState(false)
  const [cidadeValida, setCidadeValida] = useState(false)
  const [consultandoCnpj, setConsultandoCnpj] = useState(false)
  const [cnpjMsg, setCnpjMsg] = useState('')
  const [cnpjTipo, setCnpjTipo] = useState('')
  const [cnpjTimer, setCnpjTimer] = useState(null)
  const [filtroStatus, setFiltroStatus] = useState(null)
  const [filtroAbc, setFiltroAbc] = useState(null)
  const [buscaNome, setBuscaNome] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  // Histórico de interações (modal)
  const [historicoCliente, setHistoricoCliente] = useState(null)
  const [historicoLista, setHistoricoLista] = useState([])
  const [historicoCarregando, setHistoricoCarregando] = useState(false)
  // ===== NOVO: feedback de sucesso (toast) =====
  const [aviso, setAviso] = useState('')
  const avisoTimer = useRef(null)
  const mostrarAviso = (msg) => {
    setAviso(msg)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 3000)
  }
  useEffect(() => {
    const vendedorId = usuario.admin ? null : usuario.id
    window.api.listarClientes(vendedorId).then(setClientes)
    window.api.listarVendas(vendedorId).then(setVendas)
    if (usuario.admin) {
      window.api.listarVendedores().then(setVendedores)
    }
    window.api.listarCidades().then(setCidades)
  }, [usuario])
  useEffect(() => {
    if (!historicoCliente) return
    setHistoricoCarregando(true)
    window.api
      .historicoCliente(historicoCliente.id)
      .then((res) => setHistoricoLista(Array.isArray(res) ? res : []))
      .catch(() => setHistoricoLista([]))
      .finally(() => setHistoricoCarregando(false))
  }, [historicoCliente])
  const vendedorPorId = (id) => vendedores.find((v) => v.id === id)
  const cidadesFiltradas = useMemo(() => {
    const b = buscaCidade.trim().toLowerCase()
    if (!b) return []
    return cidades.filter((c) => c.nome.toLowerCase().includes(b)).slice(0, 8)
  }, [cidades, buscaCidade])
  const clientesComIndicadores = useMemo(() => {
    const vendasPorCliente = {}
    const totalPorCliente = {}
    for (const v of vendas) {
      if (!vendasPorCliente[v.clienteId]) vendasPorCliente[v.clienteId] = []
      vendasPorCliente[v.clienteId].push(v.data)
      totalPorCliente[v.clienteId] = (totalPorCliente[v.clienteId] || 0) +
        Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0)
    }
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const hojeMs = hoje.getTime()
    const DIA = 86400000
    const ranking = Object.keys(totalPorCliente)
      .map((cid) => ({ id: cid, total: totalPorCliente[cid] }))
      .sort((a, b) => b.total - a.total)
    const totalClientesComCompra = ranking.length
    return clientes
      .map((c) => {
        const datas = (vendasPorCliente[c.id] || []).slice().sort()
        const primeiraCompra = datas.length ? datas[0] : null
        const ultimaCompra = datas.length ? datas[datas.length - 1] : null
        let diasInativo = null
        let status = 'sem-compra'
        if (ultimaCompra) {
          const dUlt = parseData(ultimaCompra)
          diasInativo = dUlt ? Math.max(0, Math.floor((hojeMs - dUlt.getTime()) / DIA)) : 0
          status = diasInativo <= 30 ? 'ativo' : diasInativo <= 90 ? 'atencao' : 'inativo'
        }
        let abc = 'C'
        const pos = ranking.findIndex((r) => r.id === c.id)
        if (pos !== -1 && totalClientesComCompra > 0) {
          const percentil = ((pos + 1) / totalClientesComCompra) * 100
          if (percentil <= 20) abc = 'A'
          else if (percentil <= 50) abc = 'B'
        }
        return { ...c, primeiraCompra, ultimaCompra, diasInativo, status, abc, totalGasto: totalPorCliente[c.id] || 0 }
      })
      // ===== ALTERADO: ativos primeiro, arquivados no FINAL =====
      .sort((a, b) => {
        const arq = Number(!!a.arquivado) - Number(!!b.arquivado)
        if (arq !== 0) return arq
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
      })
  }, [clientes, vendas])
  const contagemStatus = useMemo(() => {
    const cont = { ativo: 0, atencao: 0, inativo: 0, 'sem-compra': 0 }
    for (const c of clientesComIndicadores) cont[c.status]++
    return cont
  }, [clientesComIndicadores])
  const contagemAbc = useMemo(() => {
    const cont = { A: 0, B: 0, C: 0 }
    for (const c of clientesComIndicadores) cont[c.abc]++
    return cont
  }, [clientesComIndicadores])
  // ===== ALTERADO: busca por NOME ou por ID (código) =====
  const clientesFiltrados = useMemo(() => {
    let lista = clientesComIndicadores
    if (filtroStatus) lista = lista.filter((c) => c.status === filtroStatus)
    if (filtroAbc) lista = lista.filter((c) => c.abc === filtroAbc)
    const b = buscaNome.trim().toLowerCase()
    if (b) {
      lista = lista.filter((c) => {
        const porNome = String(c.nome || '').toLowerCase().includes(b)
        const porId = String(c.codigo) === b || String(c.codigo).startsWith(b)
        return porNome || porId
      })
    }
    return lista
  }, [clientesComIndicadores, filtroStatus, filtroAbc, buscaNome])
  async function consultarCnpj(cnpj) {
    setConsultandoCnpj(true)
    setCnpjMsg('')
    setCnpjTipo('')
    const res = await window.api.consultarCnpj(cnpj)
    setConsultandoCnpj(false)
    if (res && res.ok) {
      setForm((f) => ({ ...f, nome: res.razaoSocial || f.nome }))
      setCnpjMsg(`Nome preenchido: ${res.razaoSocial}`)
      setCnpjTipo('ok')
    } else {
      setCnpjMsg((res && res.erro) || 'CNPJ não encontrado')
      setCnpjTipo('erro')
    }
  }
  function aoDigitarCnpj(v) {
    setForm((f) => ({ ...f, cnpj: v }))
    setCnpjMsg('')
    setCnpjTipo('')
    if (cnpjTimer) clearTimeout(cnpjTimer)
    if (v.length === 14) {
      const t = setTimeout(() => consultarCnpj(v), 300)
      setCnpjTimer(t)
    }
  }
  function abrirNovo() {
    setEditando(null)
    setErro('')
    setForm(formVazio())
    setBuscaCidade('')
    setCidadeValida(false)
    setCnpjMsg('')
    setCnpjTipo('')
    setMostrarForm(true)
  }
  function abrirEdicao(c) {
    setEditando(c)
    setErro('')
    setForm({
      codigo: String(c.codigo ?? ''),
      nome: c.nome,
      cnpj: c.cnpj || '',
      email: c.email || '',
      whats: c.whats || '',
      // ===== NOVO: campo contato =====
      contato: c.contato || '',
      cidade: c.cidade || '',
      segmento: c.segmento || ''
    })
    setBuscaCidade(c.cidade || '')
    setCidadeValida(!!c.cidade)
    setCnpjMsg('')
    setCnpjTipo('')
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const codigo = Number(form.codigo)
    if (!form.codigo || !Number.isInteger(codigo) || codigo <= 0) {
      setErro('Informe um ID válido (número inteiro maior que zero).')
      return
    }
    const duplicado = clientes.some(
      (c) => Number(c.codigo) === codigo && (!editando || c.id !== editando.id)
    )
    if (duplicado) {
      setErro(`Já existe um cliente com o ID ${codigo}.`)
      return
    }
    if (form.cidade && !cidadeValida) {
      setErro('Selecione a cidade clicando na lista de sugestões (não digite manualmente).')
      return
    }
    const payload = {
      codigo,
      nome: form.nome,
      cnpj: form.cnpj,
      email: form.email,
      whats: form.whats,
      // ===== NOVO: campo contato =====
      contato: form.contato,
      cidade: form.cidade,
      segmento: form.segmento
    }
    let res
    if (editando) {
      res = await window.api.atualizarCliente({ ...editando, ...payload })
    } else {
      res = await window.api.criarCliente({ ...payload, vendedorId: usuario.id })
    }
    if (res.ok) {
      setClientes((prev) =>
        editando ? prev.map((c) => (c.id === res.cliente.id ? res.cliente : c)) : [...prev, res.cliente]
      )
      setMostrarForm(false)
      // ===== NOVO: feedback de sucesso =====
      mostrarAviso(editando ? '✅ Cliente atualizado com sucesso!' : '✅ Cliente cadastrado com sucesso!')
    } else {
      setErro(res.erro || 'Erro ao salvar o cliente.')
    }
  }
  async function deletar(cliente) {
    const id = typeof cliente === 'object' && cliente !== null ? cliente.id : cliente
    const confirmado = confirmar('Excluir este cliente?')
    if (!confirmado) return
    await window.api.deletarCliente(id)
    setClientes((prev) => prev.filter((c) => c.id !== id))
    // ===== NOVO: feedback de sucesso =====
    mostrarAviso('🗑️ Cliente excluído.')
  }
  // ===== NOVO: arquivar / desarquivar cliente =====
  async function alternarArquivar(cliente) {
    const novoEstado = !cliente.arquivado
    const confirmado = confirmar(
      novoEstado
        ? 'Arquivar este cliente? Ele ficará no final da lista e não aparecerá nas dicas/IA.'
        : 'Desarquivar este cliente?'
    )
    if (!confirmado) return
    const res = await window.api.arquivarCliente(cliente.id, novoEstado)
    if (res && res.ok) {
      setClientes((prev) => prev.map((c) => (c.id === cliente.id ? { ...c, arquivado: novoEstado } : c)))
      mostrarAviso(novoEstado ? '📦 Cliente arquivado.' : '✅ Cliente desarquivado.')
    }
  }
  const cardsPainel = [
    { status: 'ativo', rotulo: 'Ativos', cor: 'verde' },
    { status: 'atencao', rotulo: 'Atenção', cor: 'amarelo' },
    { status: 'inativo', rotulo: 'Inativos', cor: 'vermelho' }
  ]
  if (clienteSelecionado) {
    return (
      <ClienteDetalhe
        clienteId={clienteSelecionado}
        onVoltar={() => setClienteSelecionado(null)}
      />
    )
  }
  return (
    <div className="clientes">
      {/* ===== NOVO: toast de sucesso ===== */}
      {aviso && <div className="toast-sucesso">{aviso}</div>}
      <div className="section-head">
        <h2>Carteira de Clientes</h2>
        <div className="head-direita">
          {/* ===== NOVO: contador de clientes ===== */}
          <span className="total-badge">
            {clientesFiltrados.length} {clientesFiltrados.length === 1 ? 'cliente' : 'clientes'}
          </span>
          <button className="btn-primary" onClick={abrirNovo}>+ Novo Cliente</button>
        </div>
      </div>
      <div className="painel-status">
        {cardsPainel.map((card) => (
          <button
            key={card.status}
            className={`painel-card painel-${card.cor} ${filtroStatus === card.status ? 'ativo' : ''}`}
            onClick={() => setFiltroStatus(filtroStatus === card.status ? null : card.status)}
          >
            <span className="painel-numero">{contagemStatus[card.status]}</span>
            <span className="painel-rotulo">{card.rotulo}</span>
          </button>
        ))}
        <div className="painel-abc">
          {['A', 'B', 'C'].map((letra) => (
            <button
              key={letra}
              className={`painel-card abc-botao abc-${letra} ${filtroAbc === letra ? 'ativo' : ''}`}
              onClick={() => setFiltroAbc(filtroAbc === letra ? null : letra)}
              title={`Clientes da curva ${letra}`}
            >
              <span className="painel-numero">{contagemAbc[letra]}</span>
              <span className="painel-rotulo">Curva {letra}</span>
            </button>
          ))}
        </div>
        {(filtroStatus || filtroAbc || buscaNome) && (
          <button className="painel-limpar" onClick={() => { setFiltroStatus(null); setFiltroAbc(null); setBuscaNome('') }}>
            ✕ Limpar Filtros
          </button>
        )}
      </div>
      <div className="busca-cliente">
        <input
          type="text"
          value={buscaNome}
          onChange={(e) => setBuscaNome(e.target.value)}
          placeholder="🔍 Buscar cliente pelo nome ou ID..."
        />
        {buscaNome && (
          <button className="btn-limpar" onClick={() => setBuscaNome('')}>✕</button>
        )}
      </div>
      {mostrarForm && (
        <form className="cliente-form" onSubmit={salvar}>
          <h3>{editando ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          {erro && <p className="form-erro">{erro}</p>}
          <div className="cliente-form-linha">
            <label>
              ID *
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.replace(/\D/g, '') })}
                placeholder="Ex.: 1, 2, 3..."
                required
              />
            </label>
            <label>
              Nome *
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
            </label>
            <label>
              CNPJ
              <input
                value={form.cnpj}
                onChange={(e) => aoDigitarCnpj(e.target.value.replace(/\D/g, '').slice(0, 14))}
                placeholder="Digite 14 dígitos"
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              WhatsApp
              <input
                value={form.whats}
                onChange={(e) => setForm({ ...form, whats: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </label>
            {/* ===== NOVO: campo Contato ===== */}
            <label>
              Contato
              <input
                value={form.contato}
                onChange={(e) => setForm({ ...form, contato: e.target.value })}
                placeholder="Nome do contato/responsável (ex.: Maria - compras)"
              />
            </label>
            <label>
              Cidade
              <div className="cliente-busca">
                <input
                  value={buscaCidade}
                  onChange={(e) => {
                    setBuscaCidade(e.target.value)
                    setForm({ ...form, cidade: e.target.value })
                    setCidadeValida(false)
                    setMostrarCidades(true)
                  }}
                  onFocus={() => setMostrarCidades(true)}
                  onBlur={() => setTimeout(() => setMostrarCidades(false), 150)}
                  placeholder="Digite e clique na cidade (IBGE)"
                />
                {buscaCidade && !cidadeValida && (
                  <small className="cnpj-status carregando">Selecione a cidade clicando na lista abaixo</small>
                )}
                {mostrarCidades && cidadesFiltradas.length > 0 && (
                  <div className="sugestoes">
                    {cidadesFiltradas.map((c) => (
                      <button
                        type="button"
                        key={`${c.nome}-${c.uf}`}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          const val = `${c.nome} - ${c.uf}`
                          setForm((f) => ({ ...f, cidade: val }))
                          setBuscaCidade(val)
                          setCidadeValida(true)
                          setMostrarCidades(false)
                        }}
                      >
                        <span>{c.nome} - {c.uf}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label>
              Segmento
              <input
                value={form.segmento}
                onChange={(e) => setForm({ ...form, segmento: e.target.value })}
                placeholder="Ex.: Clínica, Hospital..."
              />
            </label>
            <div className="cliente-form-acoes">
              <button type="submit" className="btn-primary">Salvar</button>
              <button type="button" className="btn-secondary" onClick={() => setMostrarForm(false)}>
                Cancelar
              </button>
            </div>
          </div>
          <div className="cnpj-status-linha">
            {consultandoCnpj && <span className="cnpj-status carregando">Consultando CNPJ...</span>}
            {!consultandoCnpj && cnpjMsg && (
              <span className={`cnpj-status ${cnpjTipo}`}>{cnpjMsg}</span>
            )}
          </div>
        </form>
      )}
      {clientesFiltrados.length === 0 ? (
        <p className="empty">
          {buscaNome
            ? `Nenhum cliente encontrado para "${buscaNome}".`
            : filtroStatus || filtroAbc
              ? 'Nenhum cliente com esse filtro.'
              : 'Nenhum cliente cadastrado ainda.'}
        </p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Histórico</th>
                {usuario.admin && <th>Vendedor</th>}
                <th>CNPJ</th>
                <th>Cidade</th>
                {/* ===== NOVO: colunas de data unificadas ===== */}
                <th>Compras</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((c) => {
                const vend = vendedorPorId(c.vendedorId)
                return (
                  <tr key={c.id} className={c.arquivado ? 'linha-arquivada' : ''}>
                    <td className="rank">{c.codigo}</td>
                    <td>
                      <button className="link-cliente" onClick={() => setClienteSelecionado(c.id)}>
                        {c.nome}
                      </button>
                      {/* ===== NOVO: badge de arquivado ===== */}
                      {c.arquivado && <span className="badge-arquivado" title="Arquivado">📦</span>}
                    </td>
                    <td>
                      <button
                        className="btn-acao btn-historico-carteira"
                        onClick={() => setHistoricoCliente(c)}
                        title="Ver interações com este cliente"
                      >
                        🕓
                      </button>
                      {/* ===== NOVO: botão de arquivar ao lado do histórico ===== */}
                      <button
                        className={`btn-acao btn-arquivar ${c.arquivado ? 'ativo' : ''}`}
                        onClick={() => alternarArquivar(c)}
                        title={c.arquivado ? 'Desarquivar cliente' : 'Arquivar cliente'}
                      >
                        📦
                      </button>
                    </td>
                    {usuario.admin && <td>{vend ? vend.nome : '-'}</td>}
                    <td>{fmtCnpj(c.cnpj)}</td>
                    <td>{c.cidade}</td>
                    {/* ===== NOVO: datas unificadas em uma coluna ===== */}
                    <td className="compras-cell">
                      {c.primeiraCompra || c.ultimaCompra ? (
                        <>
                          <span className="compras-1a">1ª {fmtData(c.primeiraCompra)}</span>
                          <span className="compras-ult">Últ {fmtData(c.ultimaCompra)}</span>
                        </>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`status-badge badge-${c.status}`}>
                        {ROTULO_STATUS[c.status]}
                        {/* ===== NOVO: dias inativos dentro do badge ===== */}
                        {c.diasInativo !== null && (
                          <span className="badge-dias"> · {c.diasInativo}d</span>
                        )}
                      </span>
                    </td>
                    <td className="acoes">
                      <button className="btn-acao" onClick={() => abrirEdicao(c)} title="Editar">✏️</button>
                      <button className="btn-acao btn-acao-danger" onClick={() => deletar(c)} title="Excluir">🗑️</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Modal de histórico de interações */}
      {historicoCliente && (
        <div className="modal-overlay" onClick={() => setHistoricoCliente(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>🕓 Interações — {historicoCliente.nome}</h3>
            <p className="modal-sub">Últimas interações registradas com este cliente</p>
            {historicoCarregando ? (
              <p className="empty">Carregando...</p>
            ) : historicoLista.length === 0 ? (
              <p className="empty">Nenhuma interação registrada ainda.</p>
            ) : (
              <ul className="historico-lista">
                {historicoLista.slice().reverse().map((item, i) => (
                  <li key={i}>
                    <strong>{fmtDataHoraHist(item.data)}</strong> · {ROTULOS_TIPO_HIST[item.tipo] || item.tipo} — {item.descricao}
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-acoes">
              <button className="btn-secondary" onClick={() => setHistoricoCliente(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default Clientes