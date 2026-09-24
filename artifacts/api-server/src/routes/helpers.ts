import type { Category, Customer, Product, Sale, SaleItem, StockMovement } from "@workspace/db";

export function categoryResponse(row: Category, productCount = 0) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    productCount,
    active: row.active === 1,
  };
}

export function productResponse(row: Product, categoryName: string | null = null) {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    categoryId: row.categoryId,
    categoryName,
    price: Number(row.price),
    costPrice: Number(row.costPrice),
    stock: row.stock,
    minStock: row.minStock,
    unit: row.unit,
    active: row.active === 1,
    imageUrl: row.imageUrl,
    updatedAt: row.updatedAt,
  };
}

export function customerResponse(
  row: Customer,
  purchaseCount = 0,
  totalSpent = 0,
) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    purchaseCount,
    totalSpent,
    createdAt: row.createdAt,
  };
}

export function movementResponse(
  row: StockMovement,
  productName: string,
) {
  return {
    id: row.id,
    productId: row.productId,
    productName,
    type: row.type,
    quantity: row.quantity,
    reason: row.reason,
    previousStock: row.previousStock,
    resultingStock: row.resultingStock,
    createdAt: row.createdAt,
  };
}

export function saleResponse(
  row: Sale,
  customerName: string | null,
  items: Array<SaleItem & { productName?: string }>,
) {
  return {
    id: row.id,
    number: row.number,
    customerId: row.customerId,
    customerName,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total),
    paymentMethod: row.paymentMethod,
    createdAt: row.createdAt,
    items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName ?? "Produto",
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
  };
}