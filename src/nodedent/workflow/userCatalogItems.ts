import type { CatalogItem } from "./catalogs";

export function updateUserCatalogItem(items: CatalogItem[], nextItem: CatalogItem) {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) return [...items, nextItem];
  return items.map((item, itemIndex) => itemIndex === index ? nextItem : item);
}

export function updateUserCatalogItems(items: CatalogItem[], nextItems: CatalogItem[]) {
  return nextItems.reduce(updateUserCatalogItem, items);
}
