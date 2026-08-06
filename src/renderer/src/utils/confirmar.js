export function confirmar(mensagem) {
  const resultado = window.confirm(mensagem)
  // Devolve o foco para a janela após o diálogo nativo (corrige o bug do Electron)
  setTimeout(() => window.focus(), 0)
  return resultado
}