// ============================================================
// utils/financeiro.js
// Cálculos financeiros centralizados
// Padrão do sistema: VALOR DO PEDIDO = (insumos + equipamento) − frete
// ============================================================

// Valor do frete de uma venda/orçamento
// Aceita valor fixo ("79,90") ou porcentagem do total ("10%")
export function valorFreteDe(v) {
  const total = Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0)
  const frete = v.frete || 0
  if (typeof frete === 'string' && frete.trim().endsWith('%')) {
    return (total * (parseFloat(frete) || 0)) / 100
  }
  return Number(String(frete).replace(',', '.')) || 0
}

// Valor do pedido (total − frete), nunca negativo
export function valorPedido(v) {
  return Math.max(
    0,
    Number(v.valorInsumos || 0) + Number(v.valorEquipamento || 0) - valorFreteDe(v)
  )
}

// Alias compatível com o nome usado em Vendas/Orçamentos
export const calcularMeta = valorPedido

// Divide o frete proporcionalmente entre insumos e equipamento
// (usado no Dashboard para ratear o desconto por tipo)
export function dividirFrete(v, vi, ve) {
  const frete = valorFreteDe(v)
  const total = vi + ve
  if (total <= 0) return { vi, ve }
  const propInsumo = vi / total
  return {
    vi: Math.max(0, vi - frete * propInsumo),
    ve: Math.max(0, ve - frete * (1 - propInsumo))
  }
}

// Valor total de um orçamento (insumos + equipamento)
export function valorOrcamento(o) {
  return Number(o.valorInsumos || 0) + Number(o.valorEquipamento || 0)
}