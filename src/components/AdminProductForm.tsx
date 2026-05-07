import { useState, useEffect, useRef } from "react";
import ProductImageUploader from "./ProductImageUploader";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription?: string | null;
  price: number;
  originalPrice?: number | null;
  currency: string;
  images: string[];
  brand?: string | null;
  sku?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  categorySlug: string;
  subcategorySlug: string;
  attributes: Array<{attributeId: string; name: string; value: string; slug: string}>;
  tags?: string[] | null;
  additionalCategoryIds?: string[] | null;
  inStock: boolean;
  featured: boolean;
  status?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

interface Category {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
}

interface Subcategory {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  isActive: boolean;
}

interface AttributeDefinition {
  id: string;
  slug: string;
  name: string;
  dataType: string;
  unit?: string | null;
  isRequired: boolean;
}

interface AdminProductFormProps {
  product: Product | null;
  isNew: boolean;
}

export default function AdminProductForm({ product, isNew }: AdminProductFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState<Subcategory[]>([]);

  const [formData, setFormData] = useState({
    name: product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    longDescription: product?.longDescription || "",
    price: product?.price?.toString() || "",
    originalPrice: product?.originalPrice?.toString() || "",
    currency: product?.currency || "KES",
    brand: product?.brand || "",
    sku: product?.sku || "",
    categoryId: product?.categoryId || "",
    subcategoryId: product?.subcategoryId || "",
    categorySlug: product?.categorySlug || "",
    subcategorySlug: product?.subcategorySlug || "",
    inStock: product?.inStock ?? true,
    featured: product?.featured ?? false,
    status: product?.status || "active",
    seoTitle: product?.seoTitle || "",
    seoDescription: product?.seoDescription || "",
  });

  const [productImages, setProductImages] = useState<string[]>(product?.images || []);
  const [tags, setTags] = useState<string[]>(product?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState<string[]>(
    product?.additionalCategoryIds || []
  );

  const [productAttributes, setProductAttributes] = useState<Record<string, string>>(() => {
    const attrs: Record<string, string> = {};
    product?.attributes?.forEach(attr => {
      attrs[attr.attributeId] = attr.value;
    });
    return attrs;
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [catRes, subRes, attrRes] = await Promise.all([
          fetch("/api/admin/categories"),
          fetch("/api/admin/subcategories"),
          fetch("/api/admin/attributes"),
        ]);
        const cats = await catRes.json();
        const subs = await subRes.json();
        const attrs = await attrRes.json();
        setCategories(cats.filter((c: Category) => c.isActive));
        setSubcategories(subs);
        setAttributeDefinitions(attrs);
        if (product?.categoryId) {
          setFilteredSubcategories(subs.filter((s: Subcategory) => s.categoryId === product.categoryId && s.isActive));
        }
      } catch (err) {
        console.error("Failed to load form data:", err);
      }
    }
    loadData();
  }, [product?.categoryId]);

  useEffect(() => {
    if (formData.categoryId) {
      const filtered = subcategories.filter(s => s.categoryId === formData.categoryId && s.isActive);
      setFilteredSubcategories(filtered);
      if (!filtered.find(s => s.id === formData.subcategoryId)) {
        setFormData(prev => ({ ...prev, subcategoryId: "", subcategorySlug: "" }));
      }
    } else {
      setFilteredSubcategories([]);
    }
  }, [formData.categoryId, subcategories]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
    setSuccess(false);
  };

  const updateAttribute = (attrId: string, value: string) => {
    setProductAttributes(prev => ({ ...prev, [attrId]: value }));
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleNameChange = (name: string) => {
    updateField("name", name);
    if (isNew && !formData.slug) updateField("slug", generateSlug(name));
  };

  const handleCategoryChange = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    updateField("categoryId", categoryId);
    updateField("categorySlug", category?.slug || "");
    // Remove from additional if it was there
    setAdditionalCategoryIds(prev => prev.filter(id => id !== categoryId));
  };

  const handleSubcategoryChange = (subcategoryId: string) => {
    const subcategory = subcategories.find(s => s.id === subcategoryId);
    updateField("subcategoryId", subcategoryId);
    updateField("subcategorySlug", subcategory?.slug || "");
  };

  // Tags
  const addTag = (raw: string) => {
    const trimmed = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const handleTagBlur = () => {
    if (tagInput.trim()) addTag(tagInput);
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  // Additional categories
  const toggleAdditionalCategory = (catId: string) => {
    if (catId === formData.categoryId) return; // can't add primary as additional
    setAdditionalCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const attributesArray = Object.entries(productAttributes)
        .filter(([_, value]) => value.trim() !== "")
        .map(([attrId, value]) => {
          const attrDef = attributeDefinitions.find(a => a.id === attrId);
          return { attributeId: attrId, name: attrDef?.name || "", slug: attrDef?.slug || "", value: value.trim() };
        });

      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        longDescription: formData.longDescription || null,
        price: parseFloat(formData.price),
        originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : null,
        currency: formData.currency,
        images: productImages,
        brand: formData.brand || null,
        sku: formData.sku || null,
        categoryId: formData.categoryId || null,
        subcategoryId: formData.subcategoryId || null,
        categorySlug: formData.categorySlug,
        subcategorySlug: formData.subcategorySlug || null,
        attributes: attributesArray,
        tags,
        additionalCategoryIds,
        inStock: formData.inStock,
        featured: formData.featured,
        status: formData.status,
        seoTitle: formData.seoTitle || null,
        seoDescription: formData.seoDescription || null,
      };

      const url = isNew ? "/api/admin/products" : `/api/admin/products/${product!.id}`;
      const method = isNew ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save product");

      if (isNew) {
        window.location.href = `/admin/products/${data.id || data.product?.id}`;
      } else {
        setSuccess(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/products/${product!.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete product");
      }
      window.location.href = "/admin/products";
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-3 min-h-[48px] text-base rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary";
  const labelCls = "block text-sm font-medium mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
          Product saved successfully!
        </div>
      )}

      {/* Status */}
      <div className="bg-card border rounded-lg p-4 md:p-6 space-y-4">
        <h3 className="font-semibold">Status</h3>
        <div className="flex items-center gap-4">
          <select
            value={formData.status}
            onChange={(e) => updateField("status", e.target.value)}
            className="w-full max-w-xs px-4 py-3 min-h-[48px] text-base rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            data-testid="select-status"
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
          <span className={`inline-block px-3 py-1 text-sm rounded-full ${
            formData.status === "active"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
          }`}>
            {formData.status === "active" ? "Active" : "Draft"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {formData.status === "active"
            ? "This product is visible to customers on your storefront."
            : "This product is hidden. Set to Active when ready to publish."}
        </p>
      </div>

      {/* Basic Information */}
      <div className="bg-card border rounded-lg p-4 md:p-6 space-y-4">
        <h3 className="font-semibold">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="name">Name <span className="text-red-500">*</span></label>
            <input id="name" type="text" value={formData.name} onChange={(e) => handleNameChange(e.target.value)}
              className={inputCls} required data-testid="input-name" />
          </div>
          <div>
            <label className={labelCls} htmlFor="slug">Slug <span className="text-red-500">*</span></label>
            <input id="slug" type="text" value={formData.slug} onChange={(e) => updateField("slug", e.target.value)}
              className={inputCls} required data-testid="input-slug" />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="description">Description <span className="text-red-500">*</span></label>
          <textarea id="description" value={formData.description} onChange={(e) => updateField("description", e.target.value)}
            className={inputCls + " resize-none"} rows={3} required data-testid="input-description" />
        </div>
        <div>
          <label className={labelCls} htmlFor="longDescription">Long Description</label>
          <textarea id="longDescription" value={formData.longDescription} onChange={(e) => updateField("longDescription", e.target.value)}
            className={inputCls + " resize-none"} rows={5} data-testid="input-long-description" />
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-card border rounded-lg p-4 md:p-6 space-y-4">
        <h3 className="font-semibold">Pricing</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls} htmlFor="price">Price <span className="text-red-500">*</span></label>
            <input id="price" type="number" step="0.01" value={formData.price} onChange={(e) => updateField("price", e.target.value)}
              className={inputCls} required data-testid="input-price" />
          </div>
          <div>
            <label className={labelCls} htmlFor="originalPrice">Original Price <span className="text-muted-foreground text-xs">(for sale)</span></label>
            <input id="originalPrice" type="number" step="0.01" value={formData.originalPrice} onChange={(e) => updateField("originalPrice", e.target.value)}
              className={inputCls} placeholder="Leave blank if not on sale" data-testid="input-original-price" />
          </div>
          <div className="sm:col-span-2 md:col-span-1">
            <label className={labelCls} htmlFor="currency">Currency</label>
            <select id="currency" value={formData.currency} onChange={(e) => updateField("currency", e.target.value)}
              className={inputCls} data-testid="select-currency">
              <option value="KES">KES</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category */}
      <div className="bg-card border rounded-lg p-4 md:p-6 space-y-4">
        <h3 className="font-semibold">Category</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="categoryId">Primary Category <span className="text-red-500">*</span></label>
            <select id="categoryId" value={formData.categoryId} onChange={(e) => handleCategoryChange(e.target.value)}
              className={inputCls} required data-testid="select-category">
              <option value="">Select a category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="subcategoryId">Subcategory <span className="text-muted-foreground text-xs">(optional)</span></label>
            <select id="subcategoryId" value={formData.subcategoryId} onChange={(e) => handleSubcategoryChange(e.target.value)}
              className={inputCls} disabled={!formData.categoryId} data-testid="select-subcategory">
              <option value="">No subcategory</option>
              {filteredSubcategories.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
        </div>

        {(formData.categorySlug) && (
          <p className="text-xs text-muted-foreground">
            URL: /{formData.categorySlug}/{formData.subcategorySlug ? formData.subcategorySlug + "/" : ""}{formData.slug}
          </p>
        )}

        {/* Additional Categories */}
        {categories.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Also appears in <span className="text-muted-foreground text-xs">(additional categories)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {categories
                .filter(cat => cat.id !== formData.categoryId)
                .map(cat => (
                  <label
                    key={cat.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                      additionalCategoryIds.includes(cat.id)
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={additionalCategoryIds.includes(cat.id)}
                      onChange={() => toggleAdditionalCategory(cat.id)}
                    />
                    {additionalCategoryIds.includes(cat.id) ? (
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    ) : (
                      <span className="w-4 h-4 flex-shrink-0 rounded border border-current inline-block" />
                    )}
                    {cat.name}
                  </label>
                ))}
            </div>
            {additionalCategoryIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                This product will also appear in: {additionalCategoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="bg-card border rounded-lg p-4 md:p-6 space-y-3">
        <div>
          <h3 className="font-semibold">Tags</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Add keywords to help customers find this product. Press Enter or comma to add a tag.</p>
        </div>

        <div
          className="min-h-[48px] w-full px-3 py-2 rounded-lg border bg-background focus-within:ring-2 focus-within:ring-primary flex flex-wrap gap-2 items-center cursor-text"
          onClick={() => tagInputRef.current?.focus()}
        >
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-sm px-2.5 py-1 rounded-full">
              {tag}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                className="hover:text-red-500 transition-colors ml-0.5 leading-none"
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={handleTagBlur}
            placeholder={tags.length === 0 ? "e.g. vitamin-c, immune-support, antioxidant" : "Add another tag..."}
            className="flex-1 min-w-[120px] outline-none bg-transparent text-sm py-1"
            data-testid="input-tags"
          />
        </div>

        {tags.length > 0 && (
          <p className="text-xs text-muted-foreground">{tags.length} tag{tags.length !== 1 ? "s" : ""} added</p>
        )}
      </div>

      {/* Images */}
      <div className="bg-card border rounded-lg p-4 md:p-6 space-y-4">
        <h3 className="font-semibold">Images</h3>
        <p className="text-sm text-muted-foreground">Upload product photos. The first image will be the main photo.</p>
        <ProductImageUploader images={productImages} onChange={setProductImages} />
      </div>

      {/* Specifications */}
      {attributeDefinitions.length > 0 && (
        <div className="bg-card border rounded-lg p-4 md:p-6 space-y-4">
          <h3 className="font-semibold">Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {attributeDefinitions.map(attr => (
              <div key={attr.id}>
                <label className={labelCls} htmlFor={`attr-${attr.id}`}>
                  {attr.name}
                  {attr.unit && <span className="text-muted-foreground ml-1">({attr.unit})</span>}
                  {attr.isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                {attr.dataType === "boolean" ? (
                  <select id={`attr-${attr.id}`} value={productAttributes[attr.id] || ""} onChange={(e) => updateAttribute(attr.id, e.target.value)}
                    className={inputCls} data-testid={`input-attr-${attr.slug}`}>
                    <option value="">Not specified</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                ) : (
                  <input id={`attr-${attr.id}`} type={attr.dataType === "number" ? "number" : "text"}
                    value={productAttributes[attr.id] || ""} onChange={(e) => updateAttribute(attr.id, e.target.value)}
                    className={inputCls} placeholder={`Enter ${attr.name.toLowerCase()}`}
                    required={attr.isRequired} data-testid={`input-attr-${attr.slug}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Details */}
      <div className="bg-card border rounded-lg p-4 md:p-6 space-y-4">
        <h3 className="font-semibold">Additional Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="brand">Brand</label>
            <input id="brand" type="text" value={formData.brand} onChange={(e) => updateField("brand", e.target.value)}
              className={inputCls} data-testid="input-brand" />
          </div>
          <div>
            <label className={labelCls} htmlFor="sku">SKU</label>
            <input id="sku" type="text" value={formData.sku} onChange={(e) => updateField("sku", e.target.value)}
              className={inputCls} data-testid="input-sku" />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-3 min-h-[48px]">
            <input type="checkbox" checked={formData.inStock} onChange={(e) => updateField("inStock", e.target.checked)}
              className="w-5 h-5 rounded border-gray-300" data-testid="checkbox-in-stock" />
            <span className="text-base">In Stock</span>
          </label>
          <label className="flex items-center gap-3 min-h-[48px]">
            <input type="checkbox" checked={formData.featured} onChange={(e) => updateField("featured", e.target.checked)}
              className="w-5 h-5 rounded border-gray-300" data-testid="checkbox-featured" />
            <span className="text-base">Featured on homepage</span>
          </label>
        </div>
      </div>

      {/* SEO */}
      <div className="bg-card border rounded-lg p-4 md:p-6 space-y-4">
        <h3 className="font-semibold">Search Engine Listing</h3>
        <p className="text-sm text-muted-foreground">Customize how this product appears in Google search results.</p>
        <div>
          <label className={labelCls} htmlFor="seoTitle">Page title</label>
          <input id="seoTitle" type="text" value={formData.seoTitle} onChange={(e) => updateField("seoTitle", e.target.value)}
            className={inputCls} placeholder={formData.name || "Product name"} data-testid="input-seo-title" />
          <p className="text-xs text-muted-foreground mt-1">{(formData.seoTitle || formData.name || "").length} / 70 characters</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="seoDescription">Meta description</label>
          <textarea id="seoDescription" value={formData.seoDescription} onChange={(e) => updateField("seoDescription", e.target.value)}
            className={inputCls + " resize-none"} rows={3}
            placeholder={formData.description || "Product description"} data-testid="input-seo-description" />
          <p className="text-xs text-muted-foreground mt-1">{(formData.seoDescription || formData.description || "").length} / 160 characters</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-4">
          <p className="text-sm font-medium text-green-700 dark:text-green-400 truncate">
            {formData.seoTitle || formData.name || "Product name"}
          </p>
          <p className="text-xs text-green-600 dark:text-green-500 truncate mt-0.5">
            supplementskenya.com/{formData.categorySlug || "category"}/{formData.subcategorySlug ? formData.subcategorySlug + "/" : ""}{formData.slug || "product-slug"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {formData.seoDescription || formData.description || "Product description will appear here..."}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button type="submit" disabled={loading}
          className="bg-primary text-primary-foreground px-6 py-3 min-h-[48px] rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
          data-testid="button-save">
          {loading ? "Saving..." : isNew ? "Create Product" : "Save Changes"}
        </button>
        <a href="/admin/products"
          className="px-6 py-3 min-h-[48px] border rounded-lg font-medium hover:bg-muted transition text-center flex items-center justify-center">
          Cancel
        </a>
        {!isNew && (
          <button type="button" onClick={handleDelete} disabled={loading}
            className="sm:ml-auto px-6 py-3 min-h-[48px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition disabled:opacity-50"
            data-testid="button-delete">
            Delete Product
          </button>
        )}
      </div>
    </form>
  );
}
