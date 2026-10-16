import { useEffect, useMemo, useState } from "react";
import "./ManageMenu.css";
import axios from "axios";
import serverUrl from "../../serverUrl";
import Cookies from "js-cookie";

const emptyProduct = {
    name: "",
    description: "",
    price: "",
    category: "",
    imageUrl: "",
    available: true,
};

function ManageMenu() {
    const [storeData, setStoreData] = useState(null);
    const [menu, setMenu] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [form, setForm] = useState(emptyProduct);

    const [deleteProduct, setDeleteProduct] = useState(null);

    const menuUrl = storeData
        ? `${serverUrl}/api/v1/menu/${storeData.storeId}`
        : "";

    useEffect(() => {
        const storeId = Cookies.get("storeId");
        const storeName = Cookies.get("storeName");

        if (storeId && storeName) {
            setStoreData({ storeId, storeName });
        } else {
            setError("Restaurant session not found. Please log in again.");
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!storeData?.storeId) return;

        let cancelled = false;

        async function fetchMenu() {
            setLoading(true);
            setError("");

            try {
                const response = await axios.get(menuUrl);

                if (cancelled) return;

                const data = response.data?.data;

                if (!Array.isArray(data)) {
                    throw new Error("The server returned an invalid menu.");
                }

                setMenu(data);
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err.response?.data?.message ||
                            err.message ||
                            "Failed to load menu items."
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchMenu();

        return () => {
            cancelled = true;
        };
    }, [storeData?.storeId, menuUrl]);

    const categories = useMemo(
        () => [
            "All",
            ...new Set(
                menu
                    .map((item) => item.category?.trim())
                    .filter(Boolean)
            ),
        ],
        [menu]
    );

    const filteredMenu = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return menu.filter((item) => {
            const matchesCategory =
                categoryFilter === "All" ||
                item.category === categoryFilter;

            const matchesSearch = [
                item.id,
                item.name,
                item.description,
                item.category,
            ].some((value) =>
                String(value ?? "").toLowerCase().includes(query)
            );

            return matchesCategory && matchesSearch;
        });
    }, [menu, searchTerm, categoryFilter]);

    const availableCount = menu.filter(
        (item) => item.available !== false
    ).length;

    const unavailableCount = menu.length - availableCount;

    const formatCurrency = (value) =>
        (Number(value) || 0).toLocaleString("en-ZA", {
            style: "currency",
            currency: "ZAR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    function openCreateForm() {
        setEditingProduct(null);
        setForm(emptyProduct);
        setError("");
        setNotice("");
        setShowForm(true);
    }

    function openEditForm(product) {
        setEditingProduct(product);

        setForm({
            name: product.name ?? "",
            description: product.description ?? "",
            price: product.price ?? "",
            category: product.category ?? "",
            imageUrl: product.imageUrl ?? "",
            available: product.available !== false,
        });

        setError("");
        setNotice("");
        setShowForm(true);
    }

    function updateField(e) {
        const { name, value, type, checked } = e.target;

        setForm((current) => ({
            ...current,
            [name]: type === "checkbox" ? checked : value,
        }));
    }

    async function saveProduct(e) {
        e.preventDefault();

        const price = Number(form.price);

        if (!form.name.trim()) {
            setError("Please enter a product name.");
            return;
        }

        if (form.price === "" || !Number.isFinite(price) || price < 0) {
            setError("Please enter a valid, non-negative price.");
            return;
        }

        if (!form.category.trim()) {
            setError("Please enter a category.");
            return;
        }

        const payload = {
            name: form.name.trim(),
            description: form.description.trim(),
            price,
            category: form.category.trim(),
            imageUrl: form.imageUrl.trim(),
            available: form.available,
        };

        setSaving(true);
        setError("");

        try {
            const response = editingProduct
                ? await axios.patch(`${menuUrl}/${editingProduct.id}`, payload)
                : await axios.post(menuUrl, payload);

            const savedProduct = response.data?.data;

            if (editingProduct) {
                setMenu((current) =>
                    current.map((item) =>
                        String(item.id) === String(editingProduct.id)
                            ? { ...item, ...(savedProduct || payload) }
                            : item
                    )
                );
            } else if (savedProduct) {
                setMenu((current) => [...current, savedProduct]);
            } else {
                // Re-fetch when the server does not return the created item.
                const refreshed = await axios.get(menuUrl);
                setMenu(
                    Array.isArray(refreshed.data?.data)
                        ? refreshed.data.data
                        : []
                );
            }

            setShowForm(false);
            setNotice(
                editingProduct
                    ? "Product updated successfully."
                    : "Product created successfully."
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Could not save the product. Check your API routes."
            );
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete() {
        if (!deleteProduct) return;

        setSaving(true);
        setError("");

        try {
            await axios.delete(`${menuUrl}/${deleteProduct.id}`);

            setMenu((current) =>
                current.filter(
                    (item) => String(item.id) !== String(deleteProduct.id)
                )
            );

            setNotice("Product deleted successfully.");
            setDeleteProduct(null);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Could not delete the product. Check your API route."
            );
        } finally {
            setSaving(false);
        }
    }


async function toggleAvailability(product) {
    const newAvailability = product.available === false;

    setError("");
    setNotice("");

    try {
        const response = await axios.patch(
            `${menuUrl}/${product.id}`,
            {
                available: newAvailability,
            }
        );

        const savedProduct = response.data?.data;

        setMenu((current) =>
            current.map((item) =>
                String(item.id) === String(product.id)
                    ? {
                          ...item,
                          ...(savedProduct || {
                              available: newAvailability,
                          }),
                      }
                    : item
            )
        );

        setNotice(
            `${product.name} is now ${
                newAvailability ? "available" : "unavailable"
            }.`
        );
    } catch (err) {
        console.error("Availability update failed:", err);

        setError(
            err.response?.data?.message ||
                "Could not update product availability."
        );
    }
}


    if (!storeData) {
        return (
            <div className="menu-page-loading">
                {loading ? "Loading restaurant session…" : error}
            </div>
        );
    }

    return (
        <div className="app-shell manage-menu-page">
            <aside className="sidebar">
                <a className="brand-lockup" href="/admin">
                    <span className="brand-mark">t.</span>
                    <span>
                        <span className="brand-name">tablewise</span>
                        <br />
                        <span className="brand-sub">
                            RESTAURANT CONSOLE
                        </span>
                    </span>
                </a>

                <div className="nav-label">Workspace</div>

                <nav className="nav">
                    <a href="/admin">
                        <span className="nav-icon">▦</span>
                        Overview
                    </a>
                    <a href="/admin#parties">
                        <span className="nav-icon">◉</span>
                        Parties &amp; sessions
                    </a>
                    <a href="/admin#orders">
                        <span className="nav-icon">≡</span>
                        Orders
                    </a>
                    <a className="active" href="/admin/menu">
                        <span className="nav-icon">♧</span>
                        Menu &amp; products
                    </a>
                    <a href="/admin#waiters">
                        <span className="nav-icon">♙</span>
                        Waiter management
                    </a>
                    <a href="/admin#reports">
                        <span className="nav-icon">▥</span>
                        Reports
                    </a>
                </nav>

                <div className="nav-label">Settings</div>

                <nav className="nav">
                    <a href="/admin#settings">
                        <span className="nav-icon">⚙</span>
                        Restaurant settings
                    </a>
                    <a href="/admin#branding">
                        <span className="nav-icon">◐</span>
                        Branding &amp; appearance
                    </a>
                </nav>

                <div className="sidebar-bottom">
                    <div className="help-card">
                        <strong>Manage your menu</strong>
                        <p>
                            Keep prices, descriptions and availability up to
                            date.
                        </p>
                    </div>
                </div>
            </aside>

            <main className="main">
                <header className="topbar">
                    <div className="menu-breadcrumb">
                        <span>Workspace</span>
                        <span> / </span>
                        <strong>Menu &amp; products</strong>
                    </div>

                    <div className="top-actions">
                        <div className="user">
                            <div className="user-text">
                                <strong>{storeData.storeName}</strong>
                                <small>Restaurant admin</small>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="content">
                    <div className="page-heading">
                        <div>
                            <div className="eyebrow">
                                RESTAURANT MANAGEMENT
                            </div>
                            <h1>Menu &amp; products</h1>
                            <p>
                                Create, update and manage the items your
                                customers can order.
                            </p>
                        </div>

                        <div className="heading-actions">
                            <button
                                className="btn btn-primary"
                                type="button"
                                onClick={openCreateForm}
                            >
                                ＋ Add product
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="menu-alert menu-alert-error" role="alert">
                            {error}
                            <button
                                type="button"
                                onClick={() => setError("")}
                                aria-label="Dismiss error"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {notice && (
                        <div className="menu-alert menu-alert-success" role="status">
                            {notice}
                            <button
                                type="button"
                                onClick={() => setNotice("")}
                                aria-label="Dismiss message"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <section className="grid stats-grid menu-stats">
                        <article className="card stat-card">
                            <div className="stat-top">
                                Total products
                                <span className="stat-icon">♧</span>
                            </div>
                            <div className="stat-value">{menu.length}</div>
                            <div className="stat-foot">
                                Items in your menu
                            </div>
                        </article>

                        <article className="card stat-card">
                            <div className="stat-top">
                                Available
                                <span className="stat-icon menu-stat-green">
                                    ✓
                                </span>
                            </div>
                            <div className="stat-value">{availableCount}</div>
                            <div className="stat-foot">
                                Currently available to order
                            </div>
                        </article>

                        <article className="card stat-card">
                            <div className="stat-top">
                                Unavailable
                                <span className="stat-icon menu-stat-red">
                                    ×
                                </span>
                            </div>
                            <div className="stat-value">
                                {unavailableCount}
                            </div>
                            <div className="stat-foot">
                                Hidden or temporarily unavailable
                            </div>
                        </article>

                        <article className="card stat-card">
                            <div className="stat-top">
                                Categories
                                <span className="stat-icon menu-stat-orange">
                                    ◫
                                </span>
                            </div>
                            <div className="stat-value">
                                {categories.length - 1}
                            </div>
                            <div className="stat-foot">
                                Distinct menu categories
                            </div>
                        </article>
                    </section>

                    <section className="card menu-catalog">
                        <div className="menu-catalog-header">
                            <div>
                                <h2>Your products</h2>
                                <p>
                                    Manage the items displayed on your
                                    restaurant's digital menu.
                                </p>
                            </div>

                            <span className="pill">
                                {filteredMenu.length}{" "}
                                {filteredMenu.length === 1 ? "item" : "items"}
                            </span>
                        </div>

                        <div className="toolbar menu-toolbar">
                            <input
                                className="field field-search"
                                type="search"
                                placeholder="Search products…"
                                value={searchTerm}
                                onChange={(e) =>
                                    setSearchTerm(e.target.value)
                                }
                                aria-label="Search products"
                            />

                            <select
                                className="field"
                                value={categoryFilter}
                                onChange={(e) =>
                                    setCategoryFilter(e.target.value)
                                }
                                aria-label="Filter by category"
                            >
                                {categories.map((category) => (
                                    <option key={category} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>

                            {(searchTerm || categoryFilter !== "All") && (
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm("");
                                        setCategoryFilter("All");
                                    }}
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div className="menu-empty-state">
                                Loading menu items…
                            </div>
                        ) : filteredMenu.length === 0 ? (
                            <div className="menu-empty-state">
                                <div className="menu-empty-icon">♧</div>
                                <h3>
                                    {menu.length === 0
                                        ? "Your menu is empty"
                                        : "No products found"}
                                </h3>
                                <p>
                                    {menu.length === 0
                                        ? "Add your first product to start building your digital menu."
                                        : "Try a different search or category."}
                                </p>

                                {menu.length === 0 && (
                                    <button
                                        className="btn btn-primary"
                                        type="button"
                                        onClick={openCreateForm}
                                    >
                                        ＋ Add your first product
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid product-grid manage-product-grid">
                                {filteredMenu.map((product) => (
                                    <article
                                        className="card product-card manage-product-card"
                                        key={product.id}
                                    >
                                        <div className="manage-product-image-wrap">
                                            {product.imageUrl ? (
                                                <img
                                                    className="product-image"
                                                    src={product.imageUrl}
                                                    alt={product.name}
                                                    onError={(e) => {
                                                        e.currentTarget.style.display =
                                                            "none";
                                                    }}
                                                />
                                            ) : (
                                                <div className="menu-image-placeholder">
                                                    <span>♧</span>
                                                    <small>No image</small>
                                                </div>
                                            )}

                                            <span
                                                className={`status ${
                                                    product.available === false
                                                        ? "status-gray"
                                                        : "status-green"
                                                } manage-availability`}
                                            >
                                                {product.available === false
                                                    ? "Unavailable"
                                                    : "Available"}
                                            </span>
                                        </div>

                                        <div className="product-info">
                                            <div className="menu-product-category">
                                                {product.category ||
                                                    "Uncategorised"}
                                            </div>

                                            <h3>{product.name}</h3>

                                            <p>
                                                {product.description ||
                                                    "No description added yet."}
                                            </p>

                                            <div className="product-meta">
                                                <strong className="money">
                                                    {formatCurrency(
                                                        product.price
                                                    )}
                                                </strong>

                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() =>
                                                        openEditForm(product)
                                                    }
                                                >
                                                    Edit
                                                </button>
                                            </div>

                                            <div className="menu-product-actions">
                                                <button
                                                    type="button"
                                                    className="btn btn-soft btn-sm"
                                                    onClick={() =>
                                                        toggleAvailability(
                                                            product
                                                        )
                                                    }
                                                >
                                                    {product.available === false
                                                        ? "Make available"
                                                        : "Mark unavailable"}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() =>
                                                        setDeleteProduct(product)
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>

            {showForm && (
                <div
                    className="menu-overlay"
                    onClick={() => !saving && setShowForm(false)}
                >
                    <div
                        className="menu-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="product-form-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="menu-modal-header">
                            <div>
                                <h2 id="product-form-title">
                                    {editingProduct
                                        ? "Edit product"
                                        : "Add a product"}
                                </h2>
                                <p>
                                    Enter the details shown on your digital
                                    menu.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="menu-modal-close"
                                onClick={() => setShowForm(false)}
                                disabled={saving}
                                aria-label="Close form"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={saveProduct}>
                            <div className="menu-form-body">
                                <label className="menu-form-field">
                                    Product name *
                                    <input
                                        className="field"
                                        name="name"
                                        value={form.name}
                                        onChange={updateField}
                                        placeholder="e.g. Classic beef burger"
                                        maxLength={100}
                                        required
                                    />
                                </label>

                                <label className="menu-form-field">
                                    Description
                                    <textarea
                                        className="field menu-textarea"
                                        name="description"
                                        value={form.description}
                                        onChange={updateField}
                                        placeholder="Describe the ingredients or dish…"
                                        rows={3}
                                    />
                                </label>

                                <div className="menu-form-row">
                                    <label className="menu-form-field">
                                        Price (R) *
                                        <input
                                            className="field"
                                            name="price"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.price}
                                            onChange={updateField}
                                            placeholder="0.00"
                                            required
                                        />
                                    </label>

                                    <label className="menu-form-field">
                                        Category *
                                        <input
                                            className="field"
                                            name="category"
                                            value={form.category}
                                            onChange={updateField}
                                            placeholder="e.g. Burgers"
                                            list="menu-categories"
                                            maxLength={60}
                                            required
                                        />
                                        <datalist id="menu-categories">
                                            {categories
                                                .filter(
                                                    (category) =>
                                                        category !== "All"
                                                )
                                                .map((category) => (
                                                    <option
                                                        key={category}
                                                        value={category}
                                                    />
                                                ))}
                                        </datalist>
                                    </label>
                                </div>

                                <label className="menu-form-field">
                                    Image URL
                                    <input
                                        className="field"
                                        type="url"
                                        name="imageUrl"
                                        value={form.imageUrl}
                                        onChange={updateField}
                                        placeholder="https://example.com/image.jpg"
                                    />
                                </label>

                                {form.imageUrl && (
                                    <img
                                        className="menu-form-preview"
                                        src={form.imageUrl}
                                        alt="Product preview"
                                        onError={(e) => {
                                            e.currentTarget.style.display =
                                                "none";
                                        }}
                                        onLoad={(e) => {
                                            e.currentTarget.style.display =
                                                "block";
                                        }}
                                    />
                                )}

                                <label className="menu-availability-toggle">
                                    <input
                                        type="checkbox"
                                        name="available"
                                        checked={form.available}
                                        onChange={updateField}
                                    />
                                    <span>
                                        <strong>Available to order</strong>
                                        <small>
                                            Customers can order this product
                                            when enabled.
                                        </small>
                                    </span>
                                </label>

                                {error && (
                                    <p
                                        className="menu-form-error"
                                        role="alert"
                                    >
                                        {error}
                                    </p>
                                )}
                            </div>

                            <div className="menu-modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowForm(false)}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving}
                                >
                                    {saving
                                        ? "Saving…"
                                        : editingProduct
                                        ? "Save changes"
                                        : "Create product"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteProduct && (
                <div
                    className="menu-overlay"
                    onClick={() => !saving && setDeleteProduct(null)}
                >
                    <div
                        className="menu-confirm-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-product-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="menu-delete-icon">!</div>

                        <h2 id="delete-product-title">Delete product?</h2>

                        <p>
                            Are you sure you want to delete{" "}
                            <strong>{deleteProduct.name}</strong>? This action
                            cannot be undone.
                        </p>

                        {error && (
                            <p className="menu-form-error" role="alert">
                                {error}
                            </p>
                        )}

                        <div className="menu-confirm-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setDeleteProduct(null)}
                                disabled={saving}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={confirmDelete}
                                disabled={saving}
                            >
                                {saving ? "Deleting…" : "Delete product"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ManageMenu;