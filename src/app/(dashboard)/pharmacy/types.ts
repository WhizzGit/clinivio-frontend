// Pharmacy module-local view types shared across page.tsx and the extracted
// tab/modal components. Kept here (rather than the global src/types/index.ts)
// because these mirror UI-facing shapes specific to this module, not domain
// types shared across the rest of the app.

export interface InventoryItem {
  id: string;
  name: string;
  genericName?: string;
  category?: string;
  unit: string;
  stockQty: number;
  reorderLevel: number;
  batchNo?: string;
  expiryDate?: string;
  mrp: number;
  sellingPrice: number;
  manufacturer?: string;
  hsn?: string;
  isActive: boolean;
}

export interface PharmacyPurchase {
  id: string;
  vendorId?: string | null;
  vendorName: string;
  invoiceNo: string | null;
  purchaseDate: string;
  totalAmount: number;
  discountAmount: number;
  notes?: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    inventoryId?: string | null;
    medicineName: string;
    batchNo?: string;
    expiryDate?: string;
    quantity: number;
    freeQty: number;
    purchasePrice: number;
    mrp: number;
    sellingPrice: number;
    discountPercent: number;
    gstRate: number;
    lineTotal: number;
  }>;
}

export interface PurchaseItemForm {
  inventoryId: string;
  medicineName: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  freeQty: number;
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
  discountPercent: number;
  gstRate: number;
}
