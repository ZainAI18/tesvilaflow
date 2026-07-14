import { z } from "zod";
export const itemSchema=z.object({product_id:z.string().uuid().optional(),product_model:z.string().min(1),sku:z.string().min(1),product_type:z.string().min(1),description:z.string().min(1),brand:z.string().min(1),quantity:z.coerce.number().positive(),unit_price:z.coerce.number().nonnegative(),remarks:z.string().optional()});
export const invoiceSchema=z.object({customer_id:z.string().uuid(),invoice_date:z.coerce.date(),po_number:z.string().optional(),deposit:z.coerce.number().nonnegative().default(0),payment_method:z.string().optional(),remarks:z.string().optional(),items:z.array(itemSchema).min(1)});
export const deliveryOrderSchema=z.object({customer_id:z.string().uuid(),delivery_date:z.coerce.date(),delivery_address:z.string().min(1),contact_person:z.string().optional(),contact_number:z.string().optional(),remarks:z.string().optional(),items:z.array(itemSchema).min(1)});
export const uploadSchema=z.object({documentType:z.enum(["invoice","delivery_order"]),fileName:z.string().regex(/\.(pdf|png|jpe?g)$/i),mimeType:z.enum(["application/pdf","image/png","image/jpeg"])});
export type InvoiceInput=z.infer<typeof invoiceSchema>;
