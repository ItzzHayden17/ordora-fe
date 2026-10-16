import { useEffect, useState } from "react";
import "./Admin.css";
import axios from "axios";
import serverUrl from "../../serverUrl";
import Cookies from "js-cookie";

function Admin() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [storeData, setStoreData] = useState(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [parties, setParties] = useState([]);
    const [todaysOrders, setTodaysOrders] = useState([]);
    const [requests, setRequests] = useState([]);
    const [menu, setMenu] = useState([]);
    const [waiters, setWaiters] = useState([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [dataError, setDataError] = useState("");

    const [showAllParties, setShowAllParties] = useState(false);
    const [showAllOrders, setShowAllOrders] = useState(false);

    const [showWaiterModal, setShowWaiterModal] = useState(false);
    const [editingWaiter, setEditingWaiter] = useState(null);
    const [waiterForm, setWaiterForm] = useState({
        name: "",
        email: "",
        password: "",
        status: "Active",
    });
    const [savingWaiter, setSavingWaiter] = useState(false);
    const [waiterError, setWaiterError] = useState("");

    const [lastUpdated, setLastUpdated] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const REFRESH_INTERVAL = 3000;

    // Restore the existing restaurant session.
    useEffect(() => {
        const storeId = Cookies.get("storeId");
        const storeName = Cookies.get("storeName");

        if (storeId && storeName) {
            setStoreData({ storeId, storeName });
            setLoggedIn(true);
        }
    }, []);

    // Load dashboard information.
// Automatically refresh dashboard data every 3 seconds.
useEffect(() => {
    if (!loggedIn || !storeData?.storeId) return;

    let cancelled = false;
    let intervalId;

    const storeId = storeData.storeId;

    const endpoints = [
        {
            key: "parties",
            url: `${serverUrl}/api/v1/parties/${storeId}`,
            setter: setParties,
        },
        {
            key: "orders",
            url: `${serverUrl}/api/v1/orders/${storeId}`,
            setter: setTodaysOrders,
        },
        {
            key: "requests",
            url: `${serverUrl}/api/v1/requests/${storeId}`,
            setter: setRequests,
        },
        {
            key: "menu",
            url: `${serverUrl}/api/v1/menu/${storeId}`,
            setter: setMenu,
        },
        {
            key: "waiters",
            url: `${serverUrl}/api/v1/restaurant/${storeId}/waiters`,
            setter: setWaiters,
        },
    ];

    async function fetchDashboardData(isInitialLoad = false) {
        if (cancelled) return;

        if (isInitialLoad) {
            setLoading(true);
            setDataError("");
        }

        setRefreshing(true);

        try {
            const results = await Promise.allSettled(
                endpoints.map((endpoint) =>
                    axios.get(endpoint.url, {
                        timeout: 10000,
                    })
                )
            );

            if (cancelled) return;

            const failedEndpoints = [];

            results.forEach((result, index) => {
                const endpoint = endpoints[index];

                if (result.status === "fulfilled") {
                    const responseData = result.value.data?.data;

                    if (Array.isArray(responseData)) {
                        endpoint.setter(responseData);
                    } else {
                        failedEndpoints.push(endpoint.key);
                        console.error(
                            `Unexpected response for ${endpoint.key}:`,
                            result.value.data
                        );
                    }
                } else {
                    failedEndpoints.push(endpoint.key);

                    console.error(
                        `Dashboard refresh failed for ${endpoint.key}:`,
                        result.reason
                    );
                }
            });

            setLastUpdated(new Date());

            if (failedEndpoints.length > 0) {
                setDataError(
                    `Could not refresh: ${failedEndpoints.join(", ")}. Retrying automatically.`
                );
            } else {
                setDataError("");
            }
        } catch (error) {
            if (!cancelled) {
                console.error("Dashboard refresh failed:", error);
                setDataError(
                    "Could not refresh dashboard data. Retrying automatically."
                );
            }
        } finally {
            if (!cancelled) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }

    // Load immediately when the dashboard opens.
    fetchDashboardData(true);

    // Then refresh automatically.
    intervalId = setInterval(() => {
        fetchDashboardData(false);
    }, REFRESH_INTERVAL);

    return () => {
        cancelled = true;
        clearInterval(intervalId);
    };
}, [loggedIn, storeData?.storeId]);
    // Restaurant login.
    async function SubmitLogin(event) {
        event.preventDefault();

        try {
            const response = await axios.post(
                `${serverUrl}/api/v1/restaurant/login`,
                { email, password }
            );

            if (!response.data?.success || !response.data?.data?.id) {
                alert("Login failed. Please check your credentials.");
                return;
            }

            const data = response.data.data;

            Cookies.set("storeId", data.id, { expires: 1 });
            Cookies.set("storeName", data.name, { expires: 1 });

            setStoreData({
                storeId: data.id,
                storeName: data.name,
            });

            setPassword("");
            setLoggedIn(true);
        } catch (error) {
            console.error("Login failed:", error);

            alert(
                error.response?.data?.message ||
                "Invalid login credentials"
            );
        }
    }

    // Waiter modal functions.
    function openAddWaiter() {
        setEditingWaiter(null);

        setWaiterForm({
            name: "",
            email: "",
            password: "",
            status: "Active",
        });

        setWaiterError("");
        setShowWaiterModal(true);
    }

    function openEditWaiter(waiter) {
        setEditingWaiter(waiter);

        setWaiterForm({
            name: waiter.name || "",
            email: waiter.email || "",
            password: "",
            status: waiter.status === "Off shift"
                ? "Off shift"
                : "Active",
        });

        setWaiterError("");
        setShowWaiterModal(true);
    }

    function closeWaiterModal() {
        if (savingWaiter) return;

        setShowWaiterModal(false);
        setEditingWaiter(null);
        setWaiterError("");
    }

    async function saveWaiter(event) {
        event.preventDefault();

        if (savingWaiter) return;

        setSavingWaiter(true);
        setWaiterError("");

        const storeId = storeData.storeId;

        const url = editingWaiter
            ? `${serverUrl}/api/v1/restaurant/${storeId}/waiters/${editingWaiter.id}`
            : `${serverUrl}/api/v1/restaurant/${storeId}/waiters`;

        const payload = {
            name: waiterForm.name.trim(),
            email: waiterForm.email.trim(),
        };

        if (editingWaiter) {
            payload.status = waiterForm.status;
        }

        // Only send a password when one was entered.
        if (waiterForm.password) {
            payload.password = waiterForm.password;
        }

        try {
            const response = editingWaiter
                ? await axios.patch(url, payload)
                : await axios.post(url, {
                    ...payload,
                    password: waiterForm.password,
                });

            const savedWaiter = response.data?.data;

            if (!savedWaiter) {
                throw new Error(
                    "The server did not return the saved waiter."
                );
            }

            setWaiters((current) => {
                const exists = current.some(
                    (waiter) =>
                        String(waiter.id) === String(savedWaiter.id)
                );

                return exists
                    ? current.map((waiter) =>
                        String(waiter.id) === String(savedWaiter.id)
                            ? savedWaiter
                            : waiter
                    )
                    : [...current, savedWaiter];
            });

            setShowWaiterModal(false);
            setEditingWaiter(null);
            setWaiterForm({
                name: "",
                email: "",
                password: "",
                status: "Active",
            });
        } catch (error) {
            setWaiterError(
                error.response?.data?.message ||
                error.response?.data?.error?.message ||
                error.message ||
                "Could not save the waiter."
            );
        } finally {
            setSavingWaiter(false);
        }
    }

    // Start or end a waiter's shift.
    async function toggleWaiterStatus(waiter) {
        const newStatus = waiter.status === "Active"
            ? "Off shift"
            : "Active";

        try {
            const response = await axios.patch(
                `${serverUrl}/api/v1/restaurant/${storeData.storeId}/waiters/${waiter.id}`,
                { status: newStatus }
            );

            const updatedWaiter = response.data?.data;

            if (!updatedWaiter) {
                throw new Error("The server did not return the updated waiter.");
            }

            setWaiters((current) =>
                current.map((entry) =>
                    String(entry.id) === String(waiter.id)
                        ? updatedWaiter
                        : entry
                )
            );
        } catch (error) {
            setDataError(
                error.response?.data?.message ||
                error.response?.data?.error?.message ||
                "Could not update the waiter's shift status."
            );
        }
    }

    // Delete a waiter.
    async function deleteWaiter(waiter) {
        const confirmed = window.confirm(
            `Delete waiter ${waiter.name}? This cannot be undone.`
        );

        if (!confirmed) return;

        try {
            await axios.delete(
                `${serverUrl}/api/v1/restaurant/${storeData.storeId}/waiters/${waiter.id}`
            );

            setWaiters((current) =>
                current.filter(
                    (entry) => String(entry.id) !== String(waiter.id)
                )
            );

            setWaiterError("");
        } catch (error) {
            setWaiterError(
                error.response?.data?.message ||
                error.response?.data?.error?.message ||
                "Could not delete the waiter."
            );

            setShowWaiterModal(true);
        }
    }

    // Dashboard search.
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const matchesSearch = (values) =>
        !normalizedSearch ||
        values.some((value) => {
            if (value === null || value === undefined) return false;

            if (typeof value === "object") {
                return JSON.stringify(value)
                    .toLowerCase()
                    .includes(normalizedSearch);
            }

            return String(value)
                .toLowerCase()
                .includes(normalizedSearch);
        });

    const filteredOrders = todaysOrders.filter((order) =>
        matchesSearch([
            order.id,
            order.partyId,
            order.customerName,
            order.status,
            ...(order.items || []).map((item) => item.name),
        ])
    );

    const filteredParties = parties.filter((party) =>
        matchesSearch([
            party.id,
            party.location,
            party.waiterName,
            party.status,
            party.customerCount,
            ...(party.customers || []),
        ])
    );

    const filteredMenu = menu.filter((product) =>
        matchesSearch([
            product.id,
            product.name,
            product.category,
            product.description,
            product.price,
        ])
    );

    const filteredWaiters = waiters.filter((waiter) =>
        matchesSearch([
            waiter.id,
            waiter.name,
            waiter.email,
            waiter.status,
        ])
    );

    const activeParties = parties.filter(
        (party) => party.status === "Active"
    ).length;

    const pendingRequests = requests.filter((request) =>
        ["Pending", "Open"].includes(request.status)
    ).length;

    const orderValue = todaysOrders.reduce(
        (sum, order) => sum + (Number(order.total) || 0),
        0
    );

    function formatCurrency(value, fractionDigits = 2) {
        return (Number(value) || 0).toLocaleString("en-ZA", {
            style: "currency",
            currency: "ZAR",
            maximumFractionDigits: fractionDigits,
        });
    }

    function getOrderStatusClass(status) {
        switch (status) {
            case "Pending":
                return "status-yellow";
            case "Confirmed":
            case "Completed":
                return "status-green";
            default:
                return "status-red";
        }
    }

    function getOrdersThisWeek(product) {
        const now = new Date();
        const startOfWeek = new Date(now);

        const day = startOfWeek.getDay();
        const daysSinceMonday = (day + 6) % 7;

        startOfWeek.setDate(
            startOfWeek.getDate() - daysSinceMonday
        );
        startOfWeek.setHours(0, 0, 0, 0);

        return todaysOrders.reduce((total, order) => {
            if (!order.createdAt) return total;

            const orderDate = new Date(order.createdAt);

            if (
                Number.isNaN(orderDate.getTime()) ||
                orderDate < startOfWeek ||
                orderDate > now
            ) {
                return total;
            }

            const matchingItems = (order.items || []).reduce(
                (itemTotal, item) => {
                    const productId =
                        item.productId ?? item.menuItemId;

                    return (
                        itemTotal +
                        (
                            String(productId) === String(product.id)
                                ? Number(item.quantity) || 1
                                : 0
                        )
                    );
                },
                0
            );

            return total + matchingItems;
        }, 0);
    }

    if (!loggedIn || !storeData) {
        return (
            <div className="admin-login">
                <form onSubmit={SubmitLogin}>
                    <h2>Admin Login</h2>

                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />

                    <button type="submit">Login</button>
                </form>
            </div>
        );
    }

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <a className="brand-lockup" href="#overview">
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
                    <a className="active" href="#overview">
                        <span className="nav-icon">▦</span> Overview
                    </a>
                    <a href="#parties">
                        <span className="nav-icon">◉</span>
                        Parties &amp; sessions
                    </a>
                    <a href="#orders">
                        <span className="nav-icon">≡</span> Orders
                    </a>
                    <a href="#menu">
                        <span className="nav-icon">♧</span>
                        Menu &amp; products
                    </a>
                    <a href="#waiters">
                        <span className="nav-icon">♙</span>
                        Waiter management
                    </a>
                </nav>

                <div className="nav-label">Settings</div>

                <nav className="nav">
                    <a href="#settings">
                        <span className="nav-icon">⚙</span>
                        Restaurant settings
                    </a>
                    <a href="#branding">
                        <span className="nav-icon">◐</span>
                        Branding &amp; appearance
                    </a>
                </nav>

                <div className="sidebar-bottom">
                    <div className="help-card">
                        <strong>Need a hand?</strong>
                        <p>
                            Visit the setup guide or contact support.
                        </p>
                        <a className="link" href="#help">
                            Open help centre →
                        </a>
                    </div>
                </div>
            </aside>

            <main className="main">
                <header className="topbar">
                    <div className="search">
                        <span>⌕</span>
                        <input
                            type="search"
                            placeholder="Search orders, parties, products and waiters…"
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(event.target.value)
                            }
                            aria-label="Search dashboard"
                        />

                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm("")}
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    <div className="top-actions">
                        <div className="user">
                            <div className="user-text">
                                <strong>{storeData.storeName}</strong>
                                <small>Restaurant admin</small>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                Cookies.remove("storeId");
                                Cookies.remove("storeName");
                                setStoreData(null);
                                setLoggedIn(false);
                            }}
                        >
                            Log out
                        </button>
                    </div>
                </header>

                <div className="content" id="overview">
                    <div className="page-heading">
                        <div>
                            <div className="eyebrow">
                                {new Date().toLocaleDateString("en-ZA", {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                })}
                            </div>

                            <h1>
                                Good morning, {storeData.storeName} 👋
                            </h1>

                            <p>
                                Here's what's happening at your restaurant
                                today.
                            </p>
                        </div>

                        <div className="heading-actions">
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={() => window.print()}
                            >
                                ↓ Export report
                            </button>

                            <a className="btn btn-primary" href="#parties">
                                ＋ View parties
                            </a>
                        </div>
                    </div>

                    {dataError && (
                        <p role="alert" className="error-message">
                            {dataError}
                        </p>
                    )}

                    <div className="dashboard-refresh-status">
                        <span
                            className={`refresh-indicator ${refreshing ? "is-refreshing" : ""}`}
                        />

                        <span>
                            {loading
                                ? "Loading dashboard..."
                                : refreshing
                                ? "Updating live data..."
                                : lastUpdated
                                ? `Last updated at ${lastUpdated.toLocaleTimeString("en-ZA")}`
                                : "Waiting for dashboard data..."}
                        </span>

                        <span className="refresh-interval-label">
                            Auto-refresh: 3 seconds
                        </span>
                    </div>

                    <section className="grid stats-grid">
                        <article className="card stat-card">
                            <div className="stat-top">
                                <span>Active parties</span>
                                <span className="stat-icon">◉</span>
                            </div>
                            <div className="stat-value">
                                {activeParties}
                            </div>
                        </article>

                        <article className="card stat-card">
                            <div className="stat-top">
                                <span>Orders today</span>
                                <span className="stat-icon">≡</span>
                            </div>
                            <div className="stat-value">
                                {todaysOrders.length}
                            </div>
                        </article>

                        <article className="card stat-card">
                            <div className="stat-top">
                                <span>Awaiting action</span>
                                <span className="stat-icon">◷</span>
                            </div>
                            <div className="stat-value">
                                {pendingRequests}
                            </div>
                            <div className="stat-foot">
                                Requests awaiting action
                            </div>
                        </article>

                        <article className="card stat-card">
                            <div className="stat-top">
                                <span>Order value</span>
                                <span className="stat-icon">R</span>
                            </div>
                            <div className="stat-value">
                                {formatCurrency(orderValue)}
                            </div>
                            <div className="stat-foot">
                                Order value, not verified payments
                            </div>
                        </article>
                    </section>

                    <section className="grid dashboard-grid">
                        <article className="card" id="orders">
                            <div className="card-header">
                                <h2>Recent orders</h2>
                                <a
                                    className="link"
                                    onClick={() => setShowAllOrders(true)}
                                >
                                    View all →
                                </a>
                            </div>

                            <div className="card-body">
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Order</th>
                                                <th>Party</th>
                                                <th>Submitted by</th>
                                                <th>Value</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {filteredOrders
                                                .slice(0, 6)
                                                .map((order) => (
                                                    <tr key={order.id}>
                                                        <td>
                                                            <strong>
                                                                #{order.id}
                                                            </strong>
                                                            <br />
                                                            <small>
                                                                {order.createdAt
                                                                    ? new Date(
                                                                        order.createdAt
                                                                    ).toLocaleTimeString(
                                                                        "en-ZA",
                                                                        {
                                                                            hour: "2-digit",
                                                                            minute: "2-digit",
                                                                        }
                                                                    )
                                                                    : "—"}
                                                            </small>
                                                        </td>

                                                        <td>
                                                            Party #{order.partyId}
                                                        </td>

                                                        <td>
                                                            {order.customerName || "Guest"}
                                                        </td>

                                                        <td className="money">
                                                            {formatCurrency(order.total)}
                                                        </td>

                                                        <td>
                                                            <span
                                                                className={`status ${getOrderStatusClass(
                                                                    order.status
                                                                )}`}
                                                            >
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}

                                            {filteredOrders.length === 0 && (
                                                <tr>
                                                    <td colSpan="5">
                                                        {searchTerm
                                                            ? "No orders match your search."
                                                            : "No orders available."}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </article>

                        <article className="card" id="parties">
                            <div className="card-header">
                                <h2>Live parties</h2>
                                <a
                                    className="link"
                                    type="button"
                                    onClick={() => setShowAllParties(true)}
                                >
                                    View all →
                                </a>
                            </div>

                            <div className="card-body">
                                <div className="list">
  {filteredParties
    .filter((party) => party.status !== "Closed")
    .map((party) => {
        const customerCount =
            party.customerCount ??
            party.customers?.length ??
            0;

        return (
            <div
                className="list-row"
                key={party.id}
            >
                <div className="avatar">
                    {String(party.location || party.id)
                        .slice(0, 2)
                        .toUpperCase()}
                </div>

                <div className="grow">
                    <strong>
                        Party #{party.id}
                    </strong>
                    <small>
                        {customerCount} customers · Waiter:{" "}
                        {party.waiterName || "Unassigned"}
                    </small>
                </div>

                <span
                    className={`status ${
                        party.status === "Active"
                            ? "status-green"
                            : party.status === "Needs help"
                            ? "status-yellow"
                            : "status-red"
                    }`}
                >
                    {party.status}
                </span>
            </div>
        );
    })}

                                    {filteredParties.length === 0 && (
                                        <p className="small">
                                            No parties available.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </article>
                    </section>

                    <section
                        className="grid dashboard-grid"
                        style={{ marginTop: 18 }}
                    >
                        <article className="card" id="menu">
                            <div className="card-header">
                                <h2>Menu items</h2>
                                <a className="link" href="/admin/menu">
                                    Manage menu →
                                </a>
                            </div>

                            <div className="card-body">
                                <div className="list">
                                    {filteredMenu.slice(0, 6).map((product) => (
                                        <div
                                            className="list-row"
                                            key={product.id}
                                        >
                                            {product.imageUrl && (
                                                <img
                                                    className="product-thumb"
                                                    src={product.imageUrl}
                                                    alt={product.name}
                                                />
                                            )}

                                            <div className="grow">
                                                <strong>{product.name}</strong>
                                                <small>
                                                    {product.category || "Menu item"}
                                                </small>
                                            </div>

                                            <strong className="money">
                                                {formatCurrency(product.price, 0)}
                                            </strong>
                                        </div>
                                    ))}

                                    {filteredMenu.length === 0 && (
                                        <p className="small">
                                            No menu items available.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </article>

                        <article className="card" id="waiters">
                            <div className="card-header">
                                <div>
                                    <h2>Waiter management</h2>
                                    <small>
                                        {waiters.length} team member(s)
                                    </small>
                                </div>

                                <button
                                    className="btn btn-primary"
                                    type="button"
                                    onClick={openAddWaiter}
                                >
                                    + Add waiter
                                </button>
                            </div>

                            <div className="card-body">
                                <div className="list">
                                    {filteredWaiters.map((waiter, index) => {
                                        const activeWaiterParties =
                                            parties.filter(
                                                (party) =>
                                                    String(party.waiterId) ===
                                                        String(waiter.id) &&
                                                    party.status === "Active"
                                            ).length;

                                        const initials = (waiter.name || "?")
                                            .split(" ")
                                            .map((part) => part[0] || "")
                                            .join("")
                                            .slice(0, 2)
                                            .toUpperCase();

                                        const colors = [
                                            { background: "#e4f6ed", color: "#18815d" },
                                            { background: "#eee9ff", color: "#5b45d6" },
                                            { background: "#fff0df", color: "#b76b15" },
                                            { background: "#e4f1fb", color: "#2878a5" },
                                        ];

                                        const avatarStyle = colors[index % colors.length];

                                        return (
                                            <div
                                                className="list-row waiter-list-row"
                                                key={waiter.id}
                                            >
                                                <div
                                                    className="avatar"
                                                    style={{
                                                        background: avatarStyle.background,
                                                        color: avatarStyle.color,
                                                    }}
                                                >
                                                    {initials}
                                                </div>

                                                <div className="grow waiter-details">
                                                    <strong>{waiter.name}</strong>
                                                    <small>{waiter.email}</small>
                                                    <small>
                                                        {activeWaiterParties} active{" "}
                                                        {activeWaiterParties === 1
                                                            ? "party"
                                                            : "parties"}
                                                    </small>
                                                </div>

                                                <div className="waiter-management-actions">
                                                    <span
                                                        className={`pill ${
                                                            waiter.status === "Active"
                                                                ? "waiter-on-shift"
                                                                : "waiter-off-shift"
                                                        }`}
                                                    >
                                                        {waiter.status === "Active"
                                                            ? "On shift"
                                                            : "Off shift"}
                                                    </span>

                                                    <button
                                                        className="btn btn-secondary"
                                                        type="button"
                                                        onClick={() => openEditWaiter(waiter)}
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        className="btn btn-secondary"
                                                        type="button"
                                                        onClick={() => toggleWaiterStatus(waiter)}
                                                    >
                                                        {waiter.status === "Active"
                                                            ? "End shift"
                                                            : "Start shift"}
                                                    </button>

                                                    <button
                                                        className="btn btn-secondary waiter-delete-button"
                                                        type="button"
                                                        onClick={() => deleteWaiter(waiter)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {filteredWaiters.length === 0 && (
                                        <p className="small">
                                            {searchTerm
                                                ? "No waiters match your search."
                                                : "No waiters available. Add your first waiter above."}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </article>
                    </section>

                    <p
                        className="small"
                        style={{
                            textAlign: "center",
                            margin: "28px 0 0",
                        }}
                    >
                        Tablewise UI concept · Sample data for demonstration
                    </p>
                </div>
            </main>

            {/* All parties modal */}
            {showAllParties && (
                <div
                    className="parties-overlay"
                    onClick={() => setShowAllParties(false)}
                >
                    <div
                        className="parties-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="parties-modal-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="parties-modal-header">
                            <div>
                                <h2 id="parties-modal-title">All parties</h2>
                                <p>View all restaurant parties and sessions.</p>
                            </div>

                            <button
                                type="button"
                                className="parties-modal-close"
                                onClick={() => setShowAllParties(false)}
                                aria-label="Close popup"
                            >
                                ×
                            </button>
                        </div>

                        <div className="parties-modal-summary">
                            <span>
                                Total parties: <strong>{parties.length}</strong>
                            </span>
                            <span>
                                Active: <strong>{activeParties}</strong>
                            </span>
                        </div>

                        <div className="parties-modal-body">
                            {filteredParties.length > 0 ? (
                                filteredParties.map((party) => {
                                    const customers = Array.isArray(party.customers)
                                        ? party.customers
                                        : [];

                                    const customerNames = customers.map((customer) => {
                                        if (typeof customer === "string") {
                                            return customer;
                                        }

                                        return [
                                            customer.firstName,
                                            customer.lastName,
                                        ]
                                            .filter(Boolean)
                                            .join(" ") ||
                                            customer.name ||
                                            "Guest";
                                    });

                                    return (
                                        <div
                                            className="party-modal-card"
                                            key={party.id}
                                        >
                                            <div className="party-modal-card-top">
                                                <div>
                                                    <strong>Party #{party.id}</strong>
                                                    <small>
                                                        {party.location || "Location not specified"}
                                                    </small>
                                                </div>

                                                <span
                                                    className={`status ${
                                                        party.status === "Active"
                                                            ? "status-green"
                                                            : party.status === "Needs help"
                                                            ? "status-yellow"
                                                            : "status-red"
                                                    }`}
                                                >
                                                    {party.status || "Unknown"}
                                                </span>
                                            </div>

                                            <div className="party-modal-details">
                                                <div>
                                                    <span>Waiter</span>
                                                    <strong>
                                                        {party.waiterName || "Unassigned"}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>Customers</span>
                                                    <strong>
                                                        {party.customerCount ?? customers.length}
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className="party-modal-customers">
                                                <span>Customer list</span>
                                                <p>
                                                    {customerNames.length
                                                        ? customerNames.join(", ")
                                                        : "No customer names available"}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="small parties-empty">
                                    No parties available.
                                </p>
                            )}
                        </div>

                        <div className="parties-modal-footer">
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setShowAllParties(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* All orders modal */}
            {showAllOrders && (
                <div
                    className="parties-overlay"
                    onClick={() => setShowAllOrders(false)}
                >
                    <div
                        className="parties-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="orders-modal-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="parties-modal-header">
                            <div>
                                <h2 id="orders-modal-title">All orders</h2>
                                <p>View restaurant orders and their details.</p>
                            </div>

                            <button
                                type="button"
                                className="parties-modal-close"
                                onClick={() => setShowAllOrders(false)}
                                aria-label="Close popup"
                            >
                                ×
                            </button>
                        </div>

                        <div className="parties-modal-summary">
                            <span>
                                Total orders: <strong>{todaysOrders.length}</strong>
                            </span>
                            <span>
                                Pending:{" "}
                                <strong>
                                    {
                                        todaysOrders.filter(
                                            (order) => order.status === "Pending"
                                        ).length
                                    }
                                </strong>
                            </span>
                        </div>

                        <div className="parties-modal-body">
                            {filteredOrders.length > 0 ? (
                                filteredOrders.map((order) => (
                                    <div
                                        className="party-modal-card"
                                        key={order.id}
                                    >
                                        <div className="party-modal-card-top">
                                            <div>
                                                <strong>Order #{order.id}</strong>
                                                <small>
                                                    {order.createdAt
                                                        ? new Date(order.createdAt).toLocaleString(
                                                            "en-ZA",
                                                            {
                                                                day: "2-digit",
                                                                month: "short",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            }
                                                        )
                                                        : "Date unavailable"}
                                                </small>
                                            </div>

                                            <span
                                                className={`status ${getOrderStatusClass(
                                                    order.status
                                                )}`}
                                            >
                                                {order.status || "Unknown"}
                                            </span>
                                        </div>

                                        <div className="party-modal-details">
                                            <div>
                                                <span>Party</span>
                                                <strong>
                                                    {order.partyId != null
                                                        ? `#${order.partyId}`
                                                        : "Not assigned"}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Submitted by</span>
                                                <strong>
                                                    {order.customerName || "Guest"}
                                                </strong>
                                            </div>
                                        </div>

                                        <div className="party-modal-customers">
                                            <span>Order items</span>

                                            {Array.isArray(order.items) &&
                                            order.items.length > 0 ? (
                                                <div className="order-items-list">
                                                    {order.items.map((item, index) => (
                                                        <div
                                                            className="order-item-row"
                                                            key={
                                                                item.id ??
                                                                `${item.productId ?? item.name ?? "item"}-${index}`
                                                            }
                                                        >
                                                            <span>
                                                                {(Number(item.quantity) || 1)}
                                                                {" × "}
                                                                {item.name || "Unnamed item"}
                                                            </span>

                                                            <strong>
                                                                {formatCurrency(
                                                                    (Number(item.price) || 0) *
                                                                    (Number(item.quantity) || 1)
                                                                )}
                                                            </strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p>No item details available.</p>
                                            )}
                                        </div>

                                        <div className="order-modal-total">
                                            <span>Order total</span>
                                            <strong>
                                                {formatCurrency(order.total)}
                                            </strong>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="small parties-empty">
                                    No orders available.
                                </p>
                            )}
                        </div>

                        <div className="parties-modal-footer">
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setShowAllOrders(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add / edit waiter modal */}
            {showWaiterModal && (
                <div
                    className="parties-overlay waiter-overlay"
                    onClick={closeWaiterModal}
                >
                    <div
                        className="waiter-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="waiter-modal-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="parties-modal-header">
                            <div>
                                <h2 id="waiter-modal-title">
                                    {editingWaiter ? "Edit waiter" : "Add waiter"}
                                </h2>

                                <p>
                                    {editingWaiter
                                        ? "Update this team member's details or reset their password."
                                        : "Create login credentials for a new team member."}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="parties-modal-close"
                                onClick={closeWaiterModal}
                                disabled={savingWaiter}
                                aria-label="Close waiter popup"
                            >
                                ×
                            </button>
                        </div>

                        <form className="waiter-form" onSubmit={saveWaiter}>
                            <label>
                                Full name
                                <input
                                    type="text"
                                    value={waiterForm.name}
                                    onChange={(event) =>
                                        setWaiterForm({
                                            ...waiterForm,
                                            name: event.target.value,
                                        })
                                    }
                                    placeholder="e.g. Alex Smith"
                                    autoComplete="name"
                                    required
                                />
                            </label>

                            <label>
                                Email address
                                <input
                                    type="email"
                                    value={waiterForm.email}
                                    onChange={(event) =>
                                        setWaiterForm({
                                            ...waiterForm,
                                            email: event.target.value,
                                        })
                                    }
                                    placeholder="waiter@restaurant.com"
                                    autoComplete="email"
                                    required
                                />
                            </label>

                            <label>
                                {editingWaiter
                                    ? "Reset password (optional)"
                                    : "Password"}

                                <input
                                    type="password"
                                    value={waiterForm.password}
                                    onChange={(event) =>
                                        setWaiterForm({
                                            ...waiterForm,
                                            password: event.target.value,
                                        })
                                    }
                                    placeholder={
                                        editingWaiter
                                            ? "Leave blank to keep current password"
                                            : "At least 6 characters"
                                    }
                                    autoComplete="new-password"
                                    minLength={6}
                                    required={!editingWaiter}
                                />

                                {editingWaiter && (
                                    <small className="waiter-field-help">
                                        Leave this blank if you do not want to change the password.
                                    </small>
                                )}
                            </label>

                            {editingWaiter && (
                                <label>
                                    Shift status
                                    <select
                                        value={waiterForm.status}
                                        onChange={(event) =>
                                            setWaiterForm({
                                                ...waiterForm,
                                                status: event.target.value,
                                            })
                                        }
                                    >
                                        <option value="Active">
                                            Active / on shift
                                        </option>
                                        <option value="Off shift">
                                            Off shift
                                        </option>
                                    </select>
                                </label>
                            )}

                            {waiterError && (
                                <p className="waiter-form-error" role="alert">
                                    {waiterError}
                                </p>
                            )}

                            <div className="waiter-form-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={closeWaiterModal}
                                    disabled={savingWaiter}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={savingWaiter}
                                >
                                    {savingWaiter
                                        ? "Saving…"
                                        : editingWaiter
                                        ? "Save changes"
                                        : "Create waiter"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Admin;