/**
 * Shared domain model types used across all Olive & Ivory repos.
 *
 * @dependencies
 * - consumers: oi-api, oi-admin, oi-storefront all import these types
 */

export type OrderStatus = "pending" | "paid" | "packed" | "out_for_delivery" | "delivered" | "cancelled" | "expired";

export interface Order {
  id: string;
  order_number?: number | null;
  created_at: string;
  status: OrderStatus;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address_country?: string;
  address_state?: string;
  address_suburb?: string;
  address_postcode?: string;
  address_line1?: string;
  address_line2?: string | null;
  delivery_zone_key?: string | null;
  delivery_address_line1: string;
  delivery_address_line2?: string | null;
  delivery_suburb: string;
  delivery_state: string;
  delivery_postcode: string;
  delivery_date: string;
  gift_message?: string | null;
  customer_notes?: string | null;
  delivery_notes?: string | null;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  payment_provider?: "manual" | "stripe_checkout" | null;
  payment_status?: "pending" | "paid" | "failed" | "cancelled" | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  order_stock_restored?: number;
  customer_email_status?: "pending" | "sent" | "failed";
  admin_email_status?: "pending" | "sent" | "failed";
}

export interface OrderItem {
  id: string;
  order_id: string;
  collection_id: string;
  collection_name: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
}

export type OrderWithItems = Order & {
  items: OrderItem[];
};

export interface DeliveryZone {
  id: string;
  zone_key?: string | null;
  state?: string | null;
  country?: string | null;
  suburb: string;
  fee_cents: number;
  active: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  published: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  name: string;
  presentable_name?: string | null;
  price_per_pack_cents: number;
  cost_per_pack_cents: number;
  stock_on_hand: number;
  low_stock_threshold: number;
  slug?: string;
  tags?: string | null;
  barcode_gtin?: string | null;
  status: "draft" | "active" | "archived";
  store?: string | null;
  brand?: string | null;
  supplier_url?: string | null;
  location?: string | null;
  weight_grams?: number | null;
  dimensions?: string | null;
  is_active?: number;
  notes?: string | null;
  hero_image_key?: string | null;
  variants_json?: string | null;
  qty_per_pack?: number | null;
  unit_size?: number | null;
  unit_type?: "g" | "ml" | "each" | "pair" | "set" | null;
  use_whole_set?: boolean | null;
  total_individual_qty?: number | null;
  price_per_unit_cents?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  description_short?: string | null;
  description_long?: string | null;
  experience?: string | null;
  perfect_for?: string | null;
  moment?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  tags?: string | null;
  hero_image_key?: string;
  gallery_image_keys?: string | null;
  price_cents: number;
  status: "draft" | "active" | "archived";
  created_at?: string;
  updated_at?: string;
}

export interface CollectionItemRow {
  collection_id: string;
  item_id: string;
  quantity: number;
  sort_order: number;
}

export interface GiftMedia {
  id: string;
  gift_id: string;
  image_key: string;
  alt_text?: string | null;
  is_primary: number;
  is_hidden: number;
  focal_x?: number | null;
  focal_y?: number | null;
  crop_json?: string | null;
  variants_json?: string | null;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Gift {
  id: string;
  collection_id?: string | null;
  primary_collection_name?: string | null;
  slug: string;
  name: string;
  price?: number;
  price_cents: number;
  hero_image_key?: string | null;
  description_short?: string | null;
  description_long?: string | null;
  short_description?: string | null;
  full_description?: string | null;
  tags?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  og_image_key?: string | null;
  sku?: string | null;
  delivery_notes?: string | null;
  hero_focal_x?: number | null;
  hero_focal_y?: number | null;
  hero_crop_json?: string | null;
  hero_variants_json?: string | null;
  status?: "draft" | "active" | "archived" | null;
  sort_order?: number | null;
  created_at?: string;
  updated_at?: string;
  collection_ids?: string[];
  items?: (Item & { item_id: string; quantity: number; sort_order: number })[];
  media?: GiftMedia[];
}

export interface GiftAiRun {
  id: string;
  gift_id: string;
  created_at: string;
  admin_user_id?: string | null;
  prompt_id: string;
  prompt_version: number;
  prompt_filled: string;
  input_json: string;
  output_json: string;
  model: string;
  duration_ms: number;
  correlation_id: string;
}

export interface CollectionWithItems extends Collection {
  items: (Item & { item_id: string; quantity: number; sort_order: number })[];
  gifts?: Gift[];
}

export interface CollectionComponent {
  collection_id: string;
  item_id: string;
  name: string;
  sku?: string;
  quantity: number;
  sort_order: number;
  stock_quantity?: number;
  pack_qty?: number | null;
}

export type CollectionWithImage = Collection & {
  imageUrl: string | null;
  galleryImageUrls: string[];
  components: CollectionComponent[];
  maxFulfillable: number | null;
  inStock: boolean;
};

export interface CollectionVariant {
  id: string;
  collection_id: string;
  slug: string;
  variant_name: string;
  price_cents: number;
  hero_image_key?: string | null;
  badges_json?: string | null;
  sort_order?: number | null;
  status?: "active" | "archived" | "draft" | null;
  created_at?: string;
  updated_at?: string;
}

export interface CollectionVariantItem {
  collection_variant_id: string;
  item_id: string;
  qty: number;
  sort_order: number;
  name?: string;
  sku?: string | null;
  stock_quantity?: number | null;
  pack_qty?: number | null;
}

export type CollectionVariantTile = {
  collection: CollectionWithImage;
  variant: CollectionVariant;
  badges: string[];
  imageUrl: string | null;
  href: string;
};

export type FeaturedCollectionWithGifts = {
  collection: CollectionWithImage;
  gifts: Array<{
    gift: Gift;
    imageUrl: string | null;
    href: string;
  }>;
};
