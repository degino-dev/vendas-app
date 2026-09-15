import { useEffect, useState } from 'react'
import Login from './components/Login'
import Home from './components/Home'
import Clientes from './components/Clientes'
import Vendas from './components/Vendas'
import Orcamentos from './components/Orcamentos'
import Dashboard from './components/Dashboard'
import PainelGerente from './components/PainelGerente'
import GestaoVendedores from './components/GestaoVendedores'
import Insights from './components/Insights'
import Consultar from './components/Consultar'
// ===== NOVO: modal de resumo mensal (aparece 1x por mês) =====
function ResumoMensal({ usuario, onFechar }) {
  const [resumo, setResumo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  useEffect(() => {
    if (!window.api || typeof window.api.resumoMensal !== 'function') {
      setCarregando(false)
      return
    }
    window.api
      .resumoMensal(usuario.admin ? null : usuario.id)
      .then((res) => { setResumo(res && res.ok ? res : null); setCarregando(false) })
      .catch(() => setCarregando(false))
  }, [usuario])
  if (carregando) return null
  if (!resumo) return null
  const fmtMes = (ym) => {
    const [a, m] = String(ym).split('-')
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    return nomes[Number(m) - 1] + ' de ' + a
  }
  const fmtMoeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return (
    <div className="modal-overlay">
      <div className="modal resumo-modal">
        <h3>📊 Resumo de {fmtMes(resumo.mesAntigo)}</h3>
        <p className="modal-sub">
          {usuario.admin ? 'Visão geral de todos os vendedores' : 'Sua carteira de clientes'}
        </p>
        <div className="resumo-grid">
          <div className="resumo-card">
            <strong>{fmtMoeda(resumo.totalAnt)}</strong>
            <span>Vendido em {fmtMes(resumo.mesAntigo)}</span>
          </div>
          <div className={`resumo-card ${resumo.variacao >= 0 ? 'ok' : 'ruim'}`}>
            <strong>{resumo.variacao >= 0 ? '▲' : '▼'} {Math.abs(resumo.variacao)}%</strong>
            <span>vs mês atual</span>
          </div>
          <div className="resumo-card ok">
            <strong>{resumo.subiram}</strong>
            <span>Clientes subiram no rank</span>
          </div>
          <div className="resumo-card ruim">
            <strong>{resumo.cairam}</strong>
            <span>Clientes caíram no rank</span>
          </div>
        </div>
        {resumo.destaque && (
          <div className="resumo-destaque">
            🏆 <strong>Cliente destaque:</strong> {resumo.destaque.nome} — cresceu {fmtMoeda(resumo.destaque.crescimento)} no mês!
          </div>
        )}
        <div className="resumo-listas">
          {resumo.voltaram.length > 0 && (
            <div>
              <h4>🔄 Voltaram a comprar</h4>
              <ul className="resumo-nomes">
                {resumo.voltaram.map((c, i) => (
                  <li key={i}><span className="resumo-id">{c.codigo}</span> {c.nome}</li>
                ))}
              </ul>
            </div>
          )}
          {resumo.pararam.length > 0 && (
            <div>
              <h4>⏸️ Pararam de comprar</h4>
              <ul className="resumo-nomes">
                {resumo.pararam.map((c, i) => (
                  <li key={i}><span className="resumo-id">{c.codigo}</span> {c.nome}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="modal-acoes">
          <button className="btn-primary" onClick={onFechar}>Entendi, vamos lá! 🚀</button>
        </div>
      </div>
    </div>
  )
}
function App() {
  const [usuario, setUsuario] = useState(null)
  // ===== ALTERADO: aba padrão vira a Home =====
  const [aba, setAba] = useState('home')
  const [mostrarBanco, setMostrarBanco] = useState(false)
  const [caminho, setCaminho] = useState('')
  const [novoCaminho, setNovoCaminho] = useState('')
  const [msgBanco, setMsgBanco] = useState('')
  // ===== NOVO: aviso de atualização disponível =====
  const [atualizacaoPronta, setAtualizacaoPronta] = useState(false)
  // ===== NOVO: controle do resumo mensal (1x por mês) =====
  const [mostrarResumo, setMostrarResumo] = useState(false)
  // ===== NOVO: escuta o evento de atualização baixada =====
  useEffect(() => {
    if (window.api && window.api.onUpdateBaixado) {
      window.api.onUpdateBaixado(() => setAtualizacaoPronta(true))
    }
  }, [])
  // ===== NOVO: mostra o resumo na 1ª abertura do mês (uma vez por mês) =====
  useEffect(() => {
    if (!usuario) return
    const agora = new Date()
    const chave =
      'resumo_visto_' +
      (usuario.admin ? 'admin' : usuario.id) +
      '_' + agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0')
    if (!localStorage.getItem(chave)) {
      setMostrarResumo(true)
      localStorage.setItem(chave, '1')
    }
  }, [usuario])
  // --- Toda vez que o usuário muda (login/logout), volta para a aba padrão ---
  // ===== ALTERADO: vendedor entra na Home; admin entra no Painel =====
  useEffect(() => {
    setAba(usuario && usuario.admin ? 'painel' : 'home')
    setMostrarBanco(false)
  }, [usuario])
  useEffect(() => {
    if (!usuario) return
    window.api.caminhoArquivo().then(setCaminho)
  }, [usuario])
  if (!usuario) {
    return <Login onLogin={setUsuario} />
  }
  const abas = usuario.admin
    ? [
        { id: 'painel', label: '👑 Painel do Gerente' },
        { id: 'gestao', label: 'Gestão de Vendedores' },
        { id: 'clientes', label: 'Carteira de Clientes' },
        { id: 'vendas', label: 'Vendas' },
        { id: 'orcamentos', label: 'Orçamentos' },
        { id: 'consultar', label: '🔍 Consultar' },
        { id: 'insights', label: '💡 Dicas' },
      ]
    : [
        // ===== ALTERADO: Home é a primeira aba do vendedor =====
        { id: 'home', label: '🏠 Home' },
        { id: 'clientes', label: 'Carteira de Clientes' },
        { id: 'vendas', label: 'Vendas' },
        { id: 'orcamentos', label: 'Orçamentos' },
        { id: 'dashboard', label: '📊 Análise' },
        { id: 'consultar', label: '🔍 Consultar' },
        { id: 'insights', label: '💡 Dicas' },
      ]
  async function salvarCaminho(e) {
    e.preventDefault()
    setMsgBanco('')
    const res = await window.api.alterarCaminho(novoCaminho)
    if (res.ok) {
      setCaminho(res.caminho)
      setNovoCaminho('')
      setMsgBanco('Caminho alterado com sucesso!')
      window.location.reload()
    } else {
      setMsgBanco(res.erro || 'Erro ao alterar o caminho.')
    }
  }
  return (
    <div className="app">
      {/* ===== NOVO: modal de resumo mensal ===== */}
      {usuario && mostrarResumo && (
        <ResumoMensal usuario={usuario} onFechar={() => setMostrarResumo(false)} />
      )}
      {/* ===== NOVO: aviso de atualização baixada ===== */}
      {atualizacaoPronta && (
        <div className="update-banner">
          <span>🔄 Nova versão baixada!</span>
          <button
            className="btn-primary"
            onClick={() => window.api.reiniciarParaAtualizar()}
          >
            Reiniciar agora
          </button>
        </div>
      )}
      <header className="topbar">
        <h1>Controle de Vendas</h1>
        <div className="topbar-right">
          {usuario.admin && (
            <button className="db-btn" onClick={() => setMostrarBanco((v) => !v)}>
              🗄️ Banco de Dados
            </button>
          )}
          <span className="user-info">{usuario.admin ? '👑 ' : ''}{usuario.nome}</span>
          <button className="logout-btn" onClick={() => setUsuario(null)}>Sair</button>
        </div>
      </header>
      {mostrarBanco && usuario.admin && (
        <div className="banco-painel">
          <h3>🗄️ Banco de Dados</h3>
          <p className="banco-atual">
            <strong>Local atual:</strong> {caminho}
          </p>
          <form className="banco-form" onSubmit={salvarCaminho}>
            <label>
              Novo caminho do arquivo de dados
              <input
                value={novoCaminho}
                onChange={(e) => setNovoCaminho(e.target.value)}
                placeholder="Ex.: \servidor\vendas\dados.json"
              />
            </label>
            <button type="submit" className="btn-primary">Salvar caminho</button>
          </form>
          {msgBanco && <p className="banco-msg">{msgBanco}</p>}
          <p className="banco-dica">
            Dica: se o arquivo ainda não existir no novo local, ele será criado automaticamente com os dados atuais.
          </p>
        </div>
      )}
      <nav className="tabs">
        {abas.map((a) => (
          <button
            key={a.id}
            className={aba === a.id ? 'tab active' : 'tab'}
            onClick={() => setAba(a.id)}
          >
            {a.label}
          </button>
        ))}
      </nav>
      <main className="content">
        {aba === 'painel' && <PainelGerente />}
        {aba === 'gestao' && <GestaoVendedores />}
        {aba === 'home' && <Home usuario={usuario} />}
        {aba === 'clientes' && <Clientes usuario={usuario} />}
        {aba === 'vendas' && <Vendas usuario={usuario} />}
        {aba === 'orcamentos' && <Orcamentos usuario={usuario} />}
        {aba === 'dashboard' && <Dashboard usuario={usuario} />}
        {aba === 'consultar' && <Consultar usuario={usuario} />}
        {aba === 'insights' && <Insights usuario={usuario} />}
      </main>
    </div>
  )
}
export default App