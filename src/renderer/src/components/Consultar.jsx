import { useEffect, useRef, useState } from 'react'

const EXEMPLOS = [
  'Quem compra tubo de coleta a vácuo e o que mais posso oferecer?',
  'Quais clientes estão com orçamento aguardando há mais tempo?',
  'Quem comprava com frequência e parou nos últimos 6 meses?',
  'Chegou uma micropipeta nova, quem compra equipamentos similares?',
  'Qual produto tem maior giro na minha carteira e quem ainda não compra?',
  'Quais clientes mais compram reagentes de bioquímica e qual o ticket médio?'
]

// ===== Mini-renderizador de Markdown (sem dependências) =====
function escaparHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function renderizarLinha(linha) {
  let t = escaparHtml(linha)
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  return t
}
function renderizarMarkdown(texto) {
  if (!texto) return null
  const linhas = String(texto).split('\n')
  const blocos = []
  let listaAtual = null
  let citacaoAtual = null
  const fecharLista = () => {
    if (listaAtual) { blocos.push(<ul key={'ul' + blocos.length}>{listaAtual}</ul>); listaAtual = null }
  }
  const fecharCitacao = () => {
    if (citacaoAtual) { blocos.push(<blockquote key={'bq' + blocos.length}>{citacaoAtual}</blockquote>); citacaoAtual = null }
  }
  for (const linha of linhas) {
    const l = linha.trim()
    if (l.startsWith('>')) {
      fecharLista()
      citacaoAtual = citacaoAtual || []
      citacaoAtual.push(<p key={citacaoAtual.length} dangerouslySetInnerHTML={{ __html: renderizarLinha(l.replace(/^>\s*/, '')) }} />)
      continue
    }
    fecharCitacao()
    const titulo = l.match(/^(#{1,4})\s+(.*)$/)
    if (titulo) {
      fecharLista()
      const Tag = 'h' + Math.min(titulo[1].length + 1, 4)
      blocos.push(<Tag key={'h' + blocos.length} dangerouslySetInnerHTML={{ __html: renderizarLinha(titulo[2]) }} />)
      continue
    }
    const item = l.match(/^[-*]\s+(.*)$/)
    if (item) {
      listaAtual = listaAtual || []
      listaAtual.push(<li key={listaAtual.length} dangerouslySetInnerHTML={{ __html: renderizarLinha(item[1]) }} />)
      continue
    }
    fecharLista()
    if (!l) continue
    blocos.push(<p key={'p' + blocos.length} dangerouslySetInnerHTML={{ __html: renderizarLinha(l) }} />)
  }
  fecharLista()
  fecharCitacao()
  return blocos
}

// ===== Separa a "Sugestão de Ação Prática" do restante da resposta =====
function separarSugestao(texto) {
  const t = String(texto || '')
  const linhas = t.split('\n')
  let idx = -1
  for (let i = 0; i < linhas.length; i++) {
    if (/^\s*[*_-]*\s*sugest[ãa]o de a[çc][ãa]o pr[áa]tica\s*:?/i.test(linhas[i].trim())) {
      idx = i
      break
    }
  }
  if (idx === -1) return { principal: t, sugestao: '' }
  const sugestao = linhas.slice(idx).join('\n').replace(/^\s*[*_-]*\s*Sugest[ãa]o de A[çc][ãa]o Pr[áa]tica\s*:?\s*/i, '').replace(/\*\*/g, '').trim()
  const principal = linhas.slice(0, idx).join('\n').trim()
  return { principal, sugestao }
}

export default function Consultar({ usuario }) {
  const [pergunta, setPergunta] = useState('')
  const [resposta, setResposta] = useState('')
  const [consultaId, setConsultaId] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [avaliacao, setAvaliacao] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  // ===== NOVO: feedback de sucesso (toast) =====
  const [aviso, setAviso] = useState('')
  const avisoTimer = useRef(null)
  const mostrarAviso = (msg) => {
    setAviso(msg)
    if (avisoTimer.current) clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(''), 3000)
  }
  // ===== Análise de carteira =====
  const [analisando, setAnalisando] = useState(false)
  const [analiseIA, setAnaliseIA] = useState('')
  const [msgAnalise, setMsgAnalise] = useState('')
  // ===== @-menção de clientes =====
  const [clientes, setClientes] = useState([])
  const [mostrarMencao, setMostrarMencao] = useState(false)
  const [filtroMencao, setFiltroMencao] = useState('')
  const [indiceMencao, setIndiceMencao] = useState(0)
  const [posCursor, setPosCursor] = useState(0)
  const textareaRef = useRef(null)

  // Carrega a carteira ao montar
  useEffect(() => {
    window.api.carteiraIA().then((res) => {
      if (res && res.ok) setClientes(res.clientes || [])
    })
  }, [])

  const clientesFiltrados = mostrarMencao
    ? clientes.filter((c) => {
        const busca = filtroMencao.toLowerCase()
        return !busca || String(c.nome).toLowerCase().includes(busca) || String(c.codigo).toLowerCase().includes(busca)
      }).slice(0, 8)
    : []

  function aoMudarPergunta(e) {
    const valor = e.target.value
    const cursor = e.target.selectionStart
    setPergunta(valor)
    setPosCursor(cursor)
    // ===== NOVO: limpa a resposta anterior ao digitar nova pergunta =====
    if (resposta) {
      setResposta('')
      setConsultaId(null)
      setAvaliacao(null)
      setFeedbackMsg('')
    }
    const antes = valor.slice(0, cursor)
    const ultimoArroba = antes.lastIndexOf('@')
    const ultimoEspaco = Math.max(antes.lastIndexOf(' '), antes.lastIndexOf('\n'))
    if (ultimoArroba > ultimoEspaco) {
      setMostrarMencao(true)
      setFiltroMencao(antes.slice(ultimoArroba + 1))
      setIndiceMencao(0)
    } else {
      setMostrarMencao(false)
    }
  }

  function inserirCliente(cliente) {
    const antes = pergunta.slice(0, posCursor)
    const ultimoArroba = antes.lastIndexOf('@')
    const novoTexto = antes.slice(0, ultimoArroba) + cliente.nome + ' ' + pergunta.slice(posCursor)
    setPergunta(novoTexto)
    setMostrarMencao(false)
    setFiltroMencao('')
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const novaPos = ultimoArroba + cliente.nome.length + 1
        textareaRef.current.setSelectionRange(novaPos, novaPos)
        textareaRef.current.focus()
      }
    })
  }

  function aoTeclar(e) {
    if (mostrarMencao && clientesFiltrados.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndiceMencao((i) => (i + 1) % clientesFiltrados.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndiceMencao((i) => (i - 1 + clientesFiltrados.length) % clientesFiltrados.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        inserirCliente(clientesFiltrados[indiceMencao])
        return
      }
      if (e.key === 'Escape') {
        setMostrarMencao(false)
        return
      }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      consultar()
    }
  }

  async function consultar(texto) {
    const p = (texto ?? pergunta).trim()
    if (!p) return
    setCarregando(true)
    setErro('')
    setResposta('')
    setAvaliacao(null)
    setFeedbackMsg('')
    try {
      const res = await window.api.consultarIA(p)
      if (res && res.ok) {
        setResposta(res.texto || '')
        setConsultaId(res.consultaId || null)
        if (!res.texto) setErro('A IA não retornou resposta. Tente reformular.')
      } else {
        setErro((res && res.erro) || 'Erro ao consultar.')
      }
    } catch (e) {
      setErro('Falha na consulta: ' + String(e))
    } finally {
      setCarregando(false)
    }
  }

  // ===== NOVO: permite trocar a avaliação (não trava) =====
  async function avaliar(nota) {
    if (!consultaId) return
    // Se clicar no mesmo botão já avaliado, desfaz
    if (avaliacao === nota) {
      setAvaliacao(null)
      setFeedbackMsg('')
      return
    }
    setAvaliacao(nota)
    setFeedbackMsg('')
    try {
      const res = await window.api.avaliarIA({ consultaId, nota })
      if (res && res.ok) {
        setFeedbackMsg(nota === 'bom'
          ? '✅ Obrigado! Sua resposta foi salva como exemplo para melhorar as próximas consultas.'
          : 'Obrigado pelo retorno. Vou considerar isso nas próximas respostas.')
      } else {
        setFeedbackMsg('Não foi possível salvar sua avaliação.')
      }
    } catch (e) {
      setFeedbackMsg('Falha ao salvar avaliação: ' + String(e))
    }
  }

  // ===== NOVO: copiar resposta =====
  async function copiarResposta() {
    const texto = resposta || ''
    try {
      await navigator.clipboard.writeText(texto)
      mostrarAviso('📋 Resposta copiada!')
    } catch {
      mostrarAviso('Não foi possível copiar automaticamente.')
    }
  }

  // ===== Análise de carteira =====
  async function analisarCarteira() {
    setMsgAnalise('')
    setAnaliseIA('')
    setAnalisando(true)
    try {
      const res = await window.api.analisarComIA()
      if (res && res.ok) {
        setAnaliseIA(res.texto || '')
        if (!res.texto) setMsgAnalise('A IA não retornou insights. Tente novamente.')
      } else {
        setMsgAnalise((res && res.erro) || 'Erro ao analisar com a IA.')
      }
    } catch (e) {
      setMsgAnalise('Falha na análise: ' + String(e))
    } finally {
      setAnalisando(false)
    }
  }

  const { principal, sugestao } = separarSugestao(resposta)

  return (
    <div className="consultar">
      {/* ===== NOVO: toast de sucesso ===== */}
      {aviso && <div className="toast-sucesso">{aviso}</div>}

      <div className="section-head">
        <h2>🔎 Consultar</h2>
        <span className="total-badge">Pergunte em linguagem natural — use @ para citar um cliente</span>
      </div>

      {/* Botão de análise de carteira */}
      <div className="analise-carteira">
        <button
          type="button"
          className="btn-primary analise-btn"
          onClick={analisarCarteira}
          disabled={analisando}
        >
          {analisando ? '🤖 Analisando...' : '📊 Análise de carteira'}
        </button>
        <span className="analise-dica">
          A IA analisa {usuario && usuario.admin ? 'todos os vendedores' : 'sua carteira'} e gera insights acionáveis.
        </span>
      </div>
      {msgAnalise && <p className="form-erro">{msgAnalise}</p>}
      {analiseIA && (
        // ===== NOVO: limite de altura com scroll =====
        <div className="ia-resultado">
          <h4>💡 Insights gerados</h4>
          <div className="markdown">{renderizarMarkdown(analiseIA)}</div>
        </div>
      )}

      <div className="consultar-pergunta">
        <div className="pergunta-wrapper">
          <textarea
            ref={textareaRef}
            value={pergunta}
            onChange={aoMudarPergunta}
            onKeyDown={aoTeclar}
            placeholder={'Ex.: Quais clientes compram o produto X?\nEx.: @Cliente — o que oferecer nos últimos 6 meses?'}
          />
          {mostrarMencao && clientesFiltrados.length > 0 && (
            <div className="mencao-dropdown">
              {clientesFiltrados.map((c, i) => (
                <button
                  key={c.codigo}
                  type="button"
                  className={'mencao-item ' + (i === indiceMencao ? 'mencao-item-ativo' : '')}
                  onMouseDown={(e) => { e.preventDefault(); inserirCliente(c) }}
                  onMouseEnter={() => setIndiceMencao(i)}
                >
                  <span className="mencao-nome">{c.nome}</span>
                  {c.cidade && <span className="mencao-cidade">{c.cidade}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => consultar()}
          disabled={carregando || !pergunta.trim()}
        >
          {carregando ? '🤖 Consultando...' : '🔎 Consultar'}
        </button>
      </div>

      <div className="consultar-exemplos">
        {EXEMPLOS.map((ex) => (
          <button key={ex} type="button" className="chip" onClick={() => { setPergunta(ex); consultar(ex) }} disabled={carregando}>
            {ex}
          </button>
        ))}
      </div>

      {erro && <p className="form-erro">{erro}</p>}

      {resposta && (
        // ===== NOVO: limite de altura com scroll =====
        <div className="consultar-resposta">
          <div className="resposta-topo">
            <h3>💡 Resposta</h3>
            <div className="consultar-feedback">
              <span className="feedback-rotulo">Essa resposta foi útil?</span>
              {/* ===== NOVO: botões não travam; clicar de novo desfaz ===== */}
              <button type="button" className={'btn-feedback ' + (avaliacao === 'bom' ? 'ativo-bom' : '')} onClick={() => avaliar('bom')} title="Resposta boa — salvar como exemplo">👍 Útil</button>
              <button type="button" className={'btn-feedback ' + (avaliacao === 'ruim' ? 'ativo-ruim' : '')} onClick={() => avaliar('ruim')} title="Resposta não foi útil">👎 Não útil</button>
              {/* ===== NOVO: botão copiar ===== */}
              <button type="button" className="btn-feedback btn-copiar" onClick={copiarResposta} title="Copiar resposta">📋 Copiar</button>
            </div>
          </div>
          {feedbackMsg && <p className="feedback-msg">{feedbackMsg}</p>}
          {sugestao && (
            <div className="sugestao-card">
              <strong className="sugestao-titulo">🎯 Sugestão de Ação Prática</strong>
              <div className="markdown">{renderizarMarkdown(sugestao)}</div>
            </div>
          )}
          {principal && <div className="markdown resposta-principal">{renderizarMarkdown(principal)}</div>}
        </div>
      )}
    </div>
  )
}