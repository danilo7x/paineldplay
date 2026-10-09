/**
 * Contagem de vendas para indicadores. Cada assinatura gera uma linha em
 * `sales` por mês (mensalidade); contar linhas inflaria o número de vendas.
 * Uma assinatura conta como 1 venda; as mensalidades aparecem à parte.
 */
export function countSales(sales: { subscription_id?: string | null }[]) {
  const subscriptions = new Set<string>();
  let avulsas = 0;
  let mensalidades = 0;
  for (const s of sales) {
    if (s.subscription_id) {
      subscriptions.add(s.subscription_id);
      mensalidades++;
    } else {
      avulsas++;
    }
  }
  return { vendas: avulsas + subscriptions.size, mensalidades };
}
