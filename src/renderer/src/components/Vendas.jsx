import { useEffect, useMemo, useState } from 'react'

const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const formVazio = () => ({
  clienteId: '',
  buscaCliente: '',
  envio: '',
  pedidoInsumos: '',
  valorInsumos: '',
  pedidoEquipamento: '',
  valorEquipamento: '',
  data: new Date().toISOString().slice(0, 10),
  observacao: ''
})

function Vendas({ usuario }) {
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth() + 1

  const [vendas, setVendas] = useState([])
  const [clientes, setClientes] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [filtroAno, setFiltroAno] = useState(anoAtual)
  const [filtroMes, setFiltroMes] = useState(mesAtual)
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [form, setForm] = useState(formVazio())
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState('')
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)

  useEffect(() => {
    const vendedorId = usuario.admin ? null : usuario.id
    window.api.listarVendas(vendedorId).then(setVendas)
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
    const set = new Set(vendas.map((v) => (v.data || '').slice(0, 4)))
    set.add(String(anoAtual))
    return [...set].sort().reverse()
  }, [vendas, anoAtual])

  const mesesDisponiveis = useMemo(() => {
    const set = new Set()
    for (const v of vendas) {
      const d = v.data || ''
      if (filtroAno === 'todos' || d.slice(0, 4) === String(filtroAno)) {
        const m = Number(d.slice(5, 7))
        if (m >= 1 && m <= 12) set.add(m)
      }
    }
    if (filtroAno === 'todos' || filtroAno === anoAtual) set.add(mesAtual)
    return [...set].sort((a, b) => a - b)
  }, [vendas, filtroAno, anoAtual, mesAtual])

  const vendasFiltradas = useMemo(() => {
    let lista = vendas
    if (filtroAno !== 'todos') {
      lista = lista.filter((v) => (v.data || '').slice(0, 4) === String(filtroAno))
    }
    if (filtroMes !== 'todos') {
      lista = lista.filter((v) => Number((v.data || '').slice(5, 7)) === filtroMes)
    }
    if (filtroVendedor !== 'todos') {
      lista = lista.filter((v) => v.vendedorId === filtroVendedor)
    }
    return lista
  }, [vendas, filtroAno, filtroMes, filtroVendedor])

  const vendasOrdenadas = useMemo(() => {
    return [...vendasFiltradas].sort((a, b) => {
      const cmp = (b.data || '').localeCompare(a.data || '')
      if (cmp !== 0) return cmp
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
  }, [vendasFiltradas])

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

  function abrirEdicao(v) {
    setEditando(v)
    setErro('')
    setForm({
      clienteId: v.clienteId || '',
      buscaCliente: '',
      envio: v.envio || '',
      pedidoInsumos: v.pedidoInsumos || '',
      valorInsumos: v.valorInsumos != null ? String(v.valorInsumos) : '',
      pedidoEquipamento: v.pedidoEquipamento || '',
      valorEquipamento: v.valorEquipamento != null ? String(v.valorEquipamento) : '',
      data: v.data || new Date().toISOString().slice(0, 10),
      observacao: v.observacao || ''
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
      setErro('Selecione um cliente para a venda.')
      return
    }
    const payload = {
      clienteId: form.clienteId,
      envio: form.envio,
      pedidoInsumos: form.pedidoInsumos,
      valorInsumos: Number(form.valorInsumos) || 0,
      pedidoEquipamento: form.pedidoEquipamento,
      valorEquipamento: Number(form.valorEquipamento) || 0,
      data: form.data,
      observacao: form.observacao
    }
    let res
    if (editando) {
      res = await window.api.atualizarVenda({ ...editando, ...payload })
    } else {
      res = await window.api.criarVenda({ ...payload, vendedorId: usuario.id })
    }
    if (res.ok) {
      setVendas((prev) =>
        editando ? prev.map((v) => (v.id === res.venda.id ? res.venda : v)) : [res.venda, ...prev]
      )
      setMostrarSugestoes(false)
      cancelarEdicao()
    } else {
      setErro(res.erro || 'Erro ao salvar a venda.')
    }
  }

  async function deletar(id) {
    const confirmado = confirm('Excluir esta venda?')
    window.api.focarJanela()
    if (!confirmado) return
    await window.api.deletarVenda(id)
    setVendas((prev) => prev.filter((v) => v.id !== id))
  }

  const fmtValor = (v) =>
    Number(v || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

  const fmtData = (d) => {
    if (!d) return ''
    const [ano, mes, dia] = d.split('-')
    return `${dia}/${mes}/${ano}`
  }

  const total = vendasFiltradas.reduce(
    (soma, v) => soma + Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0),
    0
  )

  return (
    <div className="vendas">
      <div className="section-head">
        <h2>Registro de Vendas</h2>
        <span className="total-badge">Total: {fmtValor(total)}</span>
      </div>

      {/* Filtros separados: Ano + Mês (com nome) + Vendedor */}
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

      {/* Formulário — título e erro fora da linha de campos */}
      <form className="venda-form" onSubmit={salvar}>
        <div className="form-titulo-linha">
          <h3>{editando ? 'Editar Venda' : 'Nova Venda'}</h3>
          {erro && <p className="form-erro">{erro}</p>}
        </div>

        <div className="venda-form-grid">
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
            <input
              value={form.envio}
              onChange={(e) => setForm({ ...form, envio: e.target.value })}
              placeholder="Tipo de envio"
            />
          </label>

          <label>
            Ped. Insumos
            <input
              value={form.pedidoInsumos}
              onChange={(e) => setForm({ ...form, pedidoInsumos: e.target.value })}
              placeholder="Descrição"
            />
          </label>

          <label>
            Valor Insumos
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.valorInsumos}
              onChange={(e) => setForm({ ...form, valorInsumos: e.target.value })}
              placeholder="0,00"
            />
          </label>

          <label>
            Ped. Equip.
            <input
              value={form.pedidoEquipamento}
              onChange={(e) => setForm({ ...form, pedidoEquipamento: e.target.value })}
              placeholder="Descrição"
            />
          </label>

          <label>
            Valor Equip.
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.valorEquipamento}
              onChange={(e) => setForm({ ...form, valorEquipamento: e.target.value })}
              placeholder="0,00"
            />
          </label>

          <label>
            Data
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
          </label>

          <label className="obs-label">
            Observação
            <input
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </label>

          <div className="venda-form-acoes">
            <button type="submit" className="btn-primary">
              {editando ? 'Salvar Alterações' : 'Registrar Venda'}
            </button>
            {editando && (
              <button type="button" className="btn-secondary" onClick={cancelarEdicao}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Tabela */}
      {vendasOrdenadas.length === 0 ? (
        <p className="empty">Nenhuma venda encontrada.</p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                {usuario.admin && <th>Vendedor</th>}
                <th>Envio</th>
                <th>Ped. Insumos</th>
                <th>Valor Insumos</th>
                <th>Ped. Equip.</th>
                <th>Valor Equip.</th>
                <th>Data</th>
                <th>Observação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendasOrdenadas.map((v) => {
                const cli = clientePorId(v.clienteId)
                const vend = vendedorPorId(v.vendedorId)
                return (
                  <tr key={v.id}>
                    <td className="rank">{cli ? cli.codigo : '-'}</td>
                    <td>{cli ? cli.nome : '(cliente removido)'}</td>
                    {usuario.admin && <td>{vend ? vend.nome : '-'}</td>}
                    <td>{v.envio}</td>
                    <td>{v.pedidoInsumos}</td>
                    <td>{fmtValor(v.valorInsumos)}</td>
                    <td>{v.pedidoEquipamento}</td>
                    <td>{fmtValor(v.valorEquipamento)}</td>
                    <td>{fmtData(v.data)}</td>
                    <td className="obs-cell">{v.observacao}</td>
                    <td className="acoes">
                      <button className="btn-acao" onClick={() => abrirEdicao(v)} title="Editar">✏️</button>
                      <button className="btn-acao btn-acao-danger" onClick={() => deletar(v)} title="Excluir">🗑️</button>
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

export default Vendas