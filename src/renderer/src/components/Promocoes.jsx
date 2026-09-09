import { useEffect, useState } from 'react'

// ============================================================
// 🔧 PROMOÇÕES DO MÊS — edite AQUI todo mês:
// troque o título e a URL pelos links novos da Heyzine
// ============================================================
const PROMOCOES = [
  { id: 'promo-insumos', titulo: '📦 Promoção Linha Diag', url: 'https://heyzine.com/flip-book/0ab883859e.html' }, 
  { id: 'promo-equipamentos', titulo: '🖥️ Promoção Linha Vet', url: 'https://heyzine.com/flip-book/0fbdad883f.html' } 
]

// ===== DOBRO da versão ultra-compacta: miniatura 128×168, fontes e botões maiores =====
const estiloPromo = `
  .promo-sub { color: #64748b; margin: 0 0 14px; font-size: 14px; }
  .promo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 14px; }
  .promo-card { display: flex; align-items: center; gap: 14px; padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .promo-thumb { width: 128px; height: 168px; flex-shrink: 0; border-radius: 8px; overflow: hidden; background: #f1f5f9; cursor: pointer; position: relative; }
  .promo-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .promo-thumb:hover { outline: 2px solid #2563eb; }
  .promo-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
  .promo-topo h3 { margin: 0; font-size: 15px; line-height: 1.3; }
  .promo-botoes { display: flex; align-items: center; gap: 10px; }
  .promo-card .btn-primary, .promo-card .btn-secondary { padding: 6px 14px; font-size: 13px; }
  .promo-link { color: #2563eb; font-size: 13px; text-decoration: none; font-weight: 600; }
  .promo-copiado { color: #16a34a; font-size: 13px; font-weight: 700; }
`

export default function Promocoes() {
  const [capas, setCapas] = useState({})
  const [copiado, setCopiado] = useState('')

  // Busca a capa de cada revista ao abrir a aba
  useEffect(() => {
    for (const p of PROMOCOES) {
      if (capas[p.id]) continue
      window.api.capaRevista(p.url)
        .then((res) => {
          if (res && res.ok) setCapas((prev) => ({ ...prev, [p.id]: res.capa }))
        })
        .catch(() => {})
    }
  }, [])

  async function copiarLink(url, id) {
    try {
      await navigator.clipboard.writeText(url)
    } catch (e) {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiado(id)
    setTimeout(() => setCopiado(''), 2500)
  }

  return (
    <div className="promocoes">
      <style>{estiloPromo}</style>
      <div className="section-head">
        <h2>📰 Promoções do Mês</h2>
      </div>
      <p className="promo-sub">
        Clique na capa para <strong>copiar o link</strong> e enviar ao cliente pelo WhatsApp ou e-mail.
      </p>
      <div className="promo-grid">
        {PROMOCOES.map((p) => (
          <div className="promo-card" key={p.id}>
            <div
              className="promo-thumb"
              onClick={() => copiarLink(p.url, p.id)}
              title="Clique para copiar o link"
            >
              {capas[p.id] ? (
                <img src={capas[p.id]} alt={'Capa ' + p.titulo} />
              ) : (
                <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>…</span>
              )}
            </div>
            <div className="promo-info">
              <div className="promo-topo"><h3>{p.titulo}</h3></div>
              <div className="promo-botoes">
                <button type="button" className="btn-primary" onClick={() => copiarLink(p.url, p.id)}>
                  {copiado === p.id ? '✅ Copiado!' : '🔗 Copiar'}
                </button>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="promo-link">Abrir ↗</a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}