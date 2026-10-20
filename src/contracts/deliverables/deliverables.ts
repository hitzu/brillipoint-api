/**
 * A product as delivered under a contract line, frozen at contracting time so
 * later catalog edits never change an issued contract.
 */
export type DeliverableItem = {
  productId: number;
  name: string;
  quantity: number;
};

type ProductRow = {
  productId: number;
  quantity: number;
  product?: { name: string } | null;
};

export function toDeliverableItems(rows: ProductRow[]): DeliverableItem[] {
  const byProductId = new Map<number, DeliverableItem>();
  for (const row of rows) {
    const existing = byProductId.get(row.productId);
    if (existing) {
      existing.quantity += row.quantity;
      continue;
    }
    byProductId.set(row.productId, {
      productId: row.productId,
      name: row.product?.name ?? '',
      quantity: row.quantity,
    });
  }
  return Array.from(byProductId.values());
}

export function withoutProducts(
  items: DeliverableItem[],
  removedProductIds: Iterable<number>,
): DeliverableItem[] {
  const removed = new Set(removedProductIds);
  return items.filter((item) => !removed.has(item.productId));
}
