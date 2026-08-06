import { useState } from 'react'

function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      const res = await window.api.login({ usuario, senha })
      if (res && res.ok) {
        onLogin(res.vendedor)
      } else {
        setErro((res && res.erro) || 'Falha no login')
        setCarregando(false)
      }
    } catch (err) {
      console.error('Erro ao chamar login:', err)
      setErro('Erro interno: ' + String(err))
      setCarregando(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={entrar}>
        <h2>Controle de Vendas</h2>
        <p className="login-sub">Faça login para continuar</p>

        <label>
          Usuário
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoFocus
            required
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </label>

        {erro && <p className="login-erro">{erro}</p>}

        <button type="submit" disabled={carregando}>
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="login-hint">Admin padrão: admin / admin123</p>
      </form>
    </div>
  )
}

export default Login