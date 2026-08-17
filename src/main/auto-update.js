// ============================================
//  AUTO-UPDATE (electron-updater)
//  Lógica de atualização separada do index.js
// ============================================
import { autoUpdater } from 'electron-updater'
import { dialog, app } from 'electron'

export function configurarAutoUpdate(win) {
  // Só atualiza em produção (app empacotado), nunca no "npm run dev"
  if (!app.isPackaged) return

  // Não baixa sozinho: baixa somente após o usuário clicar em OK
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  // ===== Erro silencioso (não trava o app) =====
  autoUpdater.on('error', (err) => {
    console.error('Erro no auto-update:', err)
  })

  // ===== 1) Versão nova encontrada ao abrir → alerta na tela =====
  autoUpdater.on('update-available', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Atualização disponível',
      message: 'Nova versão ' + info.version + ' encontrada!',
      detail: 'Clique em OK para baixar e instalar. O aplicativo fechará e reabrirá automaticamente.',
      buttons: ['OK', 'Depois'],
      defaultId: 0,
      cancelId: 1
    })
    if (response === 0) {
      autoUpdater.downloadUpdate().catch((err) => {
        console.error('Falha ao baixar atualização:', err)
      })
    }
  })

  // ===== 2) Download concluído → instala como .exe novo, com barra, e reabre =====
  autoUpdater.on('update-downloaded', () => {
    // false = mostra o instalador com a barra de progresso (como programa normal)
    // true  = reabre o aplicativo automaticamente ao terminar
    autoUpdater.quitAndInstall(false, true)
  })

  // ===== Verifica atualização 3 segundos após abrir o app =====
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Falha ao verificar atualização:', err)
    })
  }, 3000)
}