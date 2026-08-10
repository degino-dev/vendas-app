import { useEffect, useState } from 'react'
import Login from './components/Login'
import Clientes from './components/Clientes'
import Vendas from './components/Vendas'
import Orcamentos from './components/Orcamentos'
import Dashboard from './components/Dashboard'
import PainelGerente from './components/PainelGerente'
import GestaoVendedores from './components/GestaoVendedores'
import Insights from './components/Insights'

function App() {
  const [usuario, setUsuario] = useState(null)
  const [aba, setAba] = useState('clientes')
  const [mostrarBanco, setMostrarBanco] = useState(false)
  const [caminho, setCaminho] = useState('')
  const [novoCaminho, setNovoCaminho] = useState('')
  const [msgBanco, setMsgBanco] = useState('')

  // --- Inteligência Artificial (Gemini) ---
  const [mostrarIA, setMostrarIA] = useState(false)
  const [msgIA, setMsgIA] = useState('')
  const [msgIATipo, setMsgIATipo] = useState('')
  const [analisando, setAnalisando] = useState(false)
  const [resultadoIA, setResultadoIA] = useState('')

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
        { id: 'orcamentos', label: 'Orçamentos Perdidos' },
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'insights', label: '💡 Dicas' }
      ]
    : [
        { id: 'clientes', label: 'Carteira de Clientes' },
        { id: 'vendas', label: 'Vendas' },
        { id: 'orcamentos', label: 'Orçamentos Perdidos' },
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'insights', label: '💡 Dicas' }
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

  async function analisar() {
    setMsgIA('')
    setResultadoIA('')
    setAnalisando(true)
    const res = await window.api.analisarComIA()
    setAnalisando(false)
    if (res && res.ok) {
      setResultadoIA(res.texto || '')
      if (!res.texto) {
        setMsgIA('A IA não retornou insights. Tente novamente.')
        setMsgIATipo('erro')
      }
    } else {
      setMsgIA((res && res.erro) || 'Erro ao analisar com a IA.')
      setMsgIATipo('erro')
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Controle de Vendas</h1>
        <div className="topbar-right">
          <button className="ia-btn" onClick={() => setMostrarIA((v) => !v)}>
            🤖 Analisar com IA
          </button>
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

      {mostrarIA && (
        <div className="ia-painel">
          <div className="ia-head">
            <h3>🤖 Análise com Inteligência Artificial</h3>
            <button className="btn-secondary" onClick={() => setMostrarIA(false)}>Fechar</button>
          </div>
          <p className="ia-dica">
            A IA analisa {usuario.admin ? 'todos os vendedores' : 'sua carteira'} e gera insights acionáveis para aumentar as vendas.
          </p>
          {msgIA && <p className={'ia-msg ' + msgIATipo}>{msgIA}</p>}
          <button className="btn-primary ia-analisar-btn" onClick={analisar} disabled={analisando}>
            {analisando ? '🤖 Analisando...' : '🤖 Analisar com IA'}
          </button>
          {resultadoIA && (
            <div className="ia-resultado">
              <h4>💡 Insights gerados</h4>
              <pre className="ia-texto">{resultadoIA}</pre>
            </div>
          )}
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
        {aba === 'clientes' && <Clientes usuario={usuario} />}
        {aba === 'vendas' && <Vendas usuario={usuario} />}
        {aba === 'orcamentos' && <Orcamentos usuario={usuario} />}
        {aba === 'dashboard' && <Dashboard usuario={usuario} />}
        {aba === 'insights' && <Insights usuario={usuario} />}
      </main>
    </div>
  )
}
export default App