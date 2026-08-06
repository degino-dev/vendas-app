import { useEffect, useMemo, useState } from 'react'
import { confirmar } from '../utils/confirmar'

const ENVIOS = ['WHATS', 'TEL', 'TEAMS', 'EMAIL', 'PLATAFORMA']

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const formVazio = () => ({
  clienteId: '',
  buscaCliente: '',
  envio: 'WHATS',
  pedidoInsumos: '',
  valorInsumos: '',
  pedidoEquipamento: '',
  valorEquipamento: '',
  data: new Date().toISOString().slice(0, 10),
  observacao: ''
})

function mesAtualStr() {
  const agora = new Date()
  return agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0')
}

function Vendas({ usuario }) {
  const [vendas, setVendas] = useState([])
  const [clientes, setClientes] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualStr())
  const [buscaVenda, setBuscaVenda] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [form, setForm] = useState(formVazio())
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [indiceSugestao, setIndiceSugestao] = useState(0)
  const [editando, setEditando] = useState(null)

  async function carregarVendas() {
    if (!mesSelecionado) return
    const [ano, mes] = mesSelecionado.split('-')
    setCarregando(true)
    const lista = await window.api.listarVendasPorMes({
      vendedorId: usuario.admin ? null : usuario.id,
      ano: Number(ano),
      mes: Number(mes)
    })
    setVendas(lista || [])
    setCarregando(false)
  }

  useEffect(() => {
    const vendedorId = usuario.admin ? null : usuario.id
    window.api.listarClientes(vendedorId).then(setClientes)
    if (usuario.admin) {
      window.api.listarVendedores().then(setVendedores)
    }
  }, [usuario])

  useEffect(() => {
    carregarVendas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSelecionado])

  const clienteSelecionado = clientes.find((c) => c.id === form.clienteId)
  const clientePorId = (id) => clientes.find((c) => c.id === id)
  const vendedorPorId = (id) => vendedores.find((v) => v.id === id)

  // Autocomplete de cliente no formulário
  const sugestoes = useMemo(() => {
    const busca = form.buscaCliente.trim().toLowerCase()
    if (!busca || form.clienteId) return []
    return [...clientes]
      .sort((a, b) => a.codigo - b.codigo)
      .filter((c) => {
        const nome = c.nome.toLowerCase()
        const cod = String(c.codigo)
        return nome.includes(busca) || cod === busca || cod.startsWith(busca)
      })
      .slice(0, 8)
  }, [clientes, form.buscaCliente, form.clienteId])

  // Filtro por vendedor (admin) sobre as vendas do mês
  const vendasPorVendedor = useMemo(() => {
    if (!usuario.admin || filtroVendedor === 'todos') return vendas
    return vendas.filter((v) => v.vendedorId === filtroVendedor)
  }, [vendas, filtroVendedor, usuario.admin])

  // Busca por cliente (ID ou nome) dentro do mês
  const vendasFiltradas = useMemo(() => {
    const b = buscaVenda.trim().toLowerCase()
    if (!b) return vendasPorVendedor
    return vendasPorVendedor.filter((v) => {
      const cli = clientePorId(v.clienteId)
      if (!cli) return false
      const nome = cli.nome.toLowerCase()
      const cod = String(cli.codigo)
      return nome.includes(b) || cod === b || cod.startsWith(b)
    })
  }, [vendasPorVendedor, buscaVenda, clientes])

  const vendasOrdenadas = [...vendasFiltradas].sort((a, b) => b.data.localeCompare(a.data))

  const [anoSel, mesSel] = mesSelecionado.split('-')

  function escolherCliente(c) {
    setForm((f) => ({ ...f, clienteId: c.id, buscaCliente: '' }))
    setMostrarSugestoes(false)
  }

  function limparCliente() {
    setForm((f) => ({ ...f, clienteId: '', buscaCliente: '' }))
  }

  function onBuscaKey(e) {
    if (e.key === 'Escape') {
      setMostrarSugestoes(false)
      return
    }
    if (!mostrarSugestoes || sugestoes.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndiceSugestao((i) => (i + 1) % sugestoes.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceSugestao((i) => (i - 1 + sugestoes.length) % sugestoes.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      escolherCliente(sugestoes[indiceSugestao])
    }
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.clienteId) return

    const payload = {
      clienteId: form.clienteId,
      vendedorId: usuario.id,
      envio: form.envio,
      pedidoInsumos: form.pedidoInsumos,
      valorInsumos: form.valorInsumos || 0,
      pedidoEquipamento: form.pedidoEquipamento,
      valorEquipamento: form.valorEquipamento || 0,
      data: form.data,
      observacao: form.observacao
    }

    let res
    if (editando) {
      res = await window.api.atualizarVenda({ ...editando, ...payload })
    } else {
      res = await window.api.criarVenda(payload)
    }

    if (res.ok) {
      setForm(formVazio())
      setEditando(null)
      carregarVendas()
    }
  }

  function abrirEdicao(v) {
    setEditando(v)
    setForm({
      clienteId: v.clienteId,
      buscaCliente: '',
      envio: v.envio || 'WHATS',
      pedidoInsumos: v.pedidoInsumos || '',
      valorInsumos: v.valorInsumos || '',
      pedidoEquipamento: v.pedidoEquipamento || '',
      valorEquipamento: v.valorEquipamento || '',
      data: v.data || new Date().toISOString().slice(0, 10),
      observacao: v.observacao || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditando(null)
    setForm(formVazio())
  }

// Vendas.jsx
async function deletar(id) {
  const confirmado = confirm('Excluir esta venda?')
  window.api.focarJanela()
  if (!confirmado) return
  await window.api.deletarVenda(id)
  setVendas((prev) => prev.filter((v) => v.id !== id))
}

  const fmtValor = (v) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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

      {/* Barra de filtros */}
      <div className="filtros-vendas">
        <label>
          Período
          <input
            type="month"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
          />
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

        <label>
          Buscar cliente (ID ou nome)
          <input
            value={buscaVenda}
            onChange={(e) => setBuscaVenda(e.target.value)}
            placeholder="Ex.: 784 ou laboratório..."
          />
        </label>

        {(buscaVenda || (usuario.admin && filtroVendedor !== 'todos')) && (
          <button
            className="btn-limpar-filtro"
            onClick={() => {
              setBuscaVenda('')
              setFiltroVendedor('todos')
            }}
          >
            ✕ Limpar Filtro
          </button>
        )}
      </div>

      <p className="filtro-info">
        {carregando
          ? 'Carregando vendas...'
          : `Mostrando ${vendasFiltradas.length} venda(s) de ${MESES[Number(mesSel) - 1]} de ${anoSel}`}
      </p>

      <form className="venda-form" onSubmit={salvar}>
        <h3 className="form-titulo">{editando ? 'Editar Venda' : 'Nova Venda'}</h3>

        <div className="cliente-busca">
          <span className="campo-label">Cliente (ID ou Nome) *</span>

          {clienteSelecionado ? (
            <div className="cliente-selecionado">
              <span>
                <strong>#{clienteSelecionado.codigo}</strong> — {clienteSelecionado.nome}
              </span>
              <button type="button" onClick={limparCliente}>Trocar</button>
            </div>
          ) : (
            <input
              value={form.buscaCliente}
              onChange={(e) => {
                setForm({ ...form, buscaCliente: e.target.value })
                setMostrarSugestoes(true)
                setIndiceSugestao(0)
              }}
              onFocus={() => setMostrarSugestoes(true)}
              onBlur={() => setTimeout(() => setMostrarSugestoes(false), 150)}
              onKeyDown={onBuscaKey}
              placeholder="Digite o ID ou o nome..."
              required
            />
          )}

          {mostrarSugestoes && !clienteSelecionado && sugestoes.length > 0 && (
            <div className="sugestoes">
              {sugestoes.map((c, i) => (
                <button
                  type="button"
                  key={c.id}
                  className={i === indiceSugestao ? 'selecionado' : ''}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    escolherCliente(c)
                  }}
                >
                  <span className="sug-id">#{c.codigo}</span>
                  <span>{c.nome}</span>
                </button>
              ))}
            </div>
          )}

          {mostrarSugestoes &&
            !clienteSelecionado &&
            form.buscaCliente.trim() !== '' &&
            sugestoes.length === 0 && (
              <div className="sugestoes">
                <div className="sug-vazio">Nenhum cliente encontrado</div>
              </div>
            )}
        </div>

        <label>
          Envio
          <select value={form.envio} onChange={(e) => setForm({ ...form, envio: e.target.value })}>
            {ENVIOS.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </label>

        <label>
          Pedido Insumos
          <input
            value={form.pedidoInsumos}
            onChange={(e) => setForm({ ...form, pedidoInsumos: e.target.value })}
            placeholder="Nº do pedido"
          />
        </label>

        <label>
          Valor Insumos (R$)
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.valorInsumos}
            onChange={(e) => setForm({ ...form, valorInsumos: e.target.value })}
          />
        </label>

        <label>
          Pedido Equipamento
          <input
            value={form.pedidoEquipamento}
            onChange={(e) => setForm({ ...form, pedidoEquipamento: e.target.value })}
            placeholder="Nº do pedido"
          />
        </label>

        <label>
          Valor Equipamento (R$)
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.valorEquipamento}
            onChange={(e) => setForm({ ...form, valorEquipamento: e.target.value })}
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

        <label className="obs-field">
          Observação
          <input
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            placeholder="Lembrete da venda..."
          />
        </label>

        <div className="form-acoes-venda">
          <button type="submit" className="btn-primary">
            {editando ? 'Salvar Alterações' : 'Registrar'}
          </button>
          {editando && (
            <button type="button" className="btn-secondary" onClick={cancelarEdicao}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {vendasOrdenadas.length === 0 ? (
        <p className="empty">
          {carregando ? 'Carregando...' : 'Nenhuma venda neste período.'}
        </p>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
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
                      <button className="btn-acao" onClick={() => abrirEdicao(v)}>✏️ Editar</button>
                      <button className="btn-acao btn-acao-danger" onClick={() => deletar(v)}>🗑️ Excluir</button>
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