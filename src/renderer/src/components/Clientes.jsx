import { useEffect, useMemo, useState } from 'react'
import { confirmar } from '../utils/confirmar'
import ClienteDetalhe from './ClienteDetalhe'

const ROTULO_STATUS = {
  'ativo': 'Ativo',
  'atencao': 'Atenção',
  'inativo': 'Inativo',
  'sem-compra': 'Sem compras'
}

const formVazio = () => ({
  codigo: '', nome: '', cnpj: '', email: '', whats: '', cidade: '', segmento: ''
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
  const [consultandoCnpj, setConsultandoCnpj] = useState(false)
  const [cnpjMsg, setCnpjMsg] = useState('')
  const [cnpjTipo, setCnpjTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState(null)
  const [filtroAbc, setFiltroAbc] = useState(null)
  const [buscaNome, setBuscaNome] = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState(null)

  useEffect(() => {
    const vendedorId = usuario.admin ? null : usuario.id
    window.api.listarClientes(vendedorId).then(setClientes)
    window.api.listarVendas(vendedorId).then(setVendas)
    if (usuario.admin) {
      window.api.listarVendedores().then(setVendedores)
    }
    window.api.listarCidades().then(setCidades)
  }, [usuario])

  const vendedorPorId = (id) => vendedores.find((v) => v.id === id)

  // Converte "YYYY-MM-DD" em Date local (evita erro de fuso do new Date('YYYY-MM-DD'))
  const parseData = (d) => {
    if (!d) return null
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }

  // Filtra cidades do IBGE conforme o que foi digitado
  const cidadesFiltradas = useMemo(() => {
    const b = buscaCidade.trim().toLowerCase()
    if (!b) return []
    return cidades.filter((c) => c.nome.toLowerCase().includes(b)).slice(0, 8)
  }, [cidades, buscaCidade])

  // Calcula indicadores (status, datas) E a curva ABC de cada cliente
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

    // Ranking por total gasto para calcular a curva ABC
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
        // Curva ABC: posição no ranking de quem comprou
        let abc = 'C'
        const pos = ranking.findIndex((r) => r.id === c.id)
        if (pos !== -1 && totalClientesComCompra > 0) {
          const percentil = ((pos + 1) / totalClientesComCompra) * 100
          if (percentil <= 20) abc = 'A'
          else if (percentil <= 50) abc = 'B'
        }
        return { ...c, primeiraCompra, ultimaCompra, diasInativo, status, abc, totalGasto: totalPorCliente[c.id] || 0 }
      })
      // ORDENAÇÃO ALFABÉTICA POR NOME
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
  }, [clientes, vendas])

  // Contagens por status para o painel
  const contagemStatus = useMemo(() => {
    const cont = { ativo: 0, atencao: 0, inativo: 0, 'sem-compra': 0 }
    for (const c of clientesComIndicadores) cont[c.status]++
    return cont
  }, [clientesComIndicadores])

  // Contagens por curva ABC
  const contagemAbc = useMemo(() => {
    const cont = { A: 0, B: 0, C: 0 }
    for (const c of clientesComIndicadores) cont[c.abc]++
    return cont
  }, [clientesComIndicadores])

  // Aplica os filtros: status + curva ABC + busca por nome
  const clientesFiltrados = useMemo(() => {
    let lista = clientesComIndicadores
    if (filtroStatus) lista = lista.filter((c) => c.status === filtroStatus)
    if (filtroAbc) lista = lista.filter((c) => c.abc === filtroAbc)
    const b = buscaNome.trim().toLowerCase()
    if (b) lista = lista.filter((c) => String(c.nome || '').toLowerCase().includes(b))
    return lista
  }, [clientesComIndicadores, filtroStatus, filtroAbc, buscaNome])

  const fmtData = (d) => {
    if (!d) return '—'
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return d
    return `${m[3]}/${m[2]}/${m[1]}`
  }

  const fmtCnpj = (v) => {
    const s = String(v || '').replace(/\D/g, '')
    if (s.length !== 14) return v || '—'
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`
  }

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

  function abrirNovo() {
    setEditando(null)
    setErro('')
    setForm(formVazio())
    setBuscaCidade('')
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
      cidade: c.cidade || '',
      segmento: c.segmento || ''
    })
    setBuscaCidade(c.cidade || '')
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
    const payload = {
      codigo,
      nome: form.nome,
      cnpj: form.cnpj,
      email: form.email,
      whats: form.whats,
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
  }

  // Cards do painel de resumo
  const cardsPainel = [
    { status: 'ativo', rotulo: 'Ativos', cor: 'verde' },
    { status: 'atencao', rotulo: 'Atenção', cor: 'amarelo' },
    { status: 'inativo', rotulo: 'Inativos', cor: 'vermelho' }
  ]

  // DEPOIS de todos os hooks: se um cliente foi selecionado, mostra a página de estatísticas
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
      <div className="section-head">
        <h2>Carteira de Clientes</h2>
        <button className="btn-primary" onClick={abrirNovo}>+ Novo Cliente</button>
      </div>

      {/* Painel de resumo por status + curva ABC */}
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
        {/* Botões da Curva ABC */}
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

      {/* Busca por nome */}
      <div className="busca-cliente">
        <input
          type="text"
          value={buscaNome}
          onChange={(e) => setBuscaNome(e.target.value)}
          placeholder="🔍 Buscar cliente pelo nome..."
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
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 14)
                  setForm({ ...form, cnpj: v })
                  setCnpjMsg('')
                  setCnpjTipo('')
                  if (v.length === 14) consultarCnpj(v)
                }}
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
            <label>
              Cidade
              <div className="cliente-busca">
                <input
                  value={buscaCidade}
                  onChange={(e) => {
                    setBuscaCidade(e.target.value)
                    setForm({ ...form, cidade: e.target.value })
                    setMostrarCidades(true)
                  }}
                  onFocus={() => setMostrarCidades(true)}
                  onBlur={() => setTimeout(() => setMostrarCidades(false), 150)}
                  placeholder="Digite para buscar no IBGE..."
                />
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
                {usuario.admin && <th>Vendedor</th>}
                <th>CNPJ</th>
                <th>Cidade</th>
                <th>1ª Compra</th>
                <th>Últ. Compra</th>
                <th>Inativo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((c) => {
                const vend = vendedorPorId(c.vendedorId)
                return (
                  <tr key={c.id}>
                    <td className="rank">{c.codigo}</td>
                    <td>
                      <button className="link-cliente" onClick={() => setClienteSelecionado(c.id)}>
                        {c.nome}
                      </button>
                    </td>
                    {usuario.admin && <td>{vend ? vend.nome : '-'}</td>}
                    <td>{fmtCnpj(c.cnpj)}</td>
                    <td>{c.cidade}</td>
                    <td>{fmtData(c.primeiraCompra)}</td>
                    <td>{fmtData(c.ultimaCompra)}</td>
                    <td>
                      {c.diasInativo !== null ? (
                        <span className={`dias dias-${c.status}`}>
                          {c.diasInativo} {c.diasInativo === 1 ? 'dia' : 'dias'}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`status-badge badge-${c.status}`}>
                        {ROTULO_STATUS[c.status]}
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
    </div>
  )
}
export default Clientes