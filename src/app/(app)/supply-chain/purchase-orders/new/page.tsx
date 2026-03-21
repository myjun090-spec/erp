import { generatePurchaseOrderNo } from "@/lib/document-numbers";
import { PurchaseOrderForm } from "../purchase-order-form";

export default function Page() {
  return (
    <PurchaseOrderForm
      mode="create"
      initialValues={{
        poNo: generatePurchaseOrderNo(),
        vendorId: "",
        projectId: "",
        wbsId: "",
        budgetId: "",
        orderDate: "",
        dueDate: "",
        currency: "KRW",
        lines: [],
      }}
    />
  );
}
