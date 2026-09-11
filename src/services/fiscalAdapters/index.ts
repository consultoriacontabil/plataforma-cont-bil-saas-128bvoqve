import type { NfseFiscalAdapter } from './types'
import { GovBrFiscalAdapter } from './govbrAdapter'
import { BethaFiscalAdapter, GinfesFiscalAdapter } from './extensionAdapters'

export * from './types'
export * from './govbrAdapter'
export * from './extensionAdapters'

/**
 * Fábrica e catálogo de Provedores Fiscais de NFS-e (Adapter Pattern)
 */
export class FiscalAdapterFactory {
  private static adapters: Map<string, NfseFiscalAdapter> = new Map<string, NfseFiscalAdapter>([
    ['governacional', new GovBrFiscalAdapter()],
    ['betha', new BethaFiscalAdapter()],
    ['ginfes', new GinfesFiscalAdapter()],
  ])

  public static getAdapter(id?: string): NfseFiscalAdapter {
    const key = (id || 'governacional').toLowerCase()
    const adapter = this.adapters.get(key)
    if (!adapter) {
      return this.adapters.get('governacional')!
    }
    return adapter
  }

  /**
   * Resolve o adapter adequado a partir da empresa e da configuração do tenant
   * 1. Verifica se há configuração específica da empresa em config.provedores_empresas_json[empresaId]
   * 2. Caso contrário, utiliza o provedor padrão configurado no tenant (config.provedor_fiscal)
   * 3. Fallback final: 'governacional'
   */
  public static resolveAdapterForEmpresa(
    empresaId?: string,
    config?: {
      provedor_fiscal?: string
      provedores_empresas_json?: Record<string, { provedor?: string }>
    } | null,
  ): NfseFiscalAdapter {
    if (empresaId && config?.provedores_empresas_json?.[empresaId]?.provedor) {
      const provEmpresa = config.provedores_empresas_json[empresaId].provedor
      return this.getAdapter(provEmpresa)
    }
    return this.getAdapter(config?.provedor_fiscal)
  }

  public static listAdapters(): {
    id: string
    nome: string
    statusDisponibilidade: 'ativo' | 'em_breve'
    descricao: string
  }[] {
    return Array.from(this.adapters.values()).map((a) => ({
      id: a.id,
      nome: a.nome,
      statusDisponibilidade: a.statusDisponibilidade,
      descricao: a.descricao,
    }))
  }
}
