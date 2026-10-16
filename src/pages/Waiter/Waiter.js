import { useCallback, useEffect, useState } from "react";
import "./Waiter.css";
import axios from "axios";
import Cookies from "js-cookie";
import serverUrl from "../../serverUrl";
import { QRCodeSVG } from "qrcode.react";

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

function Waiter() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [storeData, setStoreData] = useState(null);
    const [waiter, setWaiter] = useState(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [orders, setOrders] = useState([]);
    const [requests, setRequests] = useState([]);
    const [parties, setParties] = useState([]);
    const [search, setSearch] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [rejectingOrder, setRejectingOrder] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [creatingParty, setCreatingParty] = useState(false);
    const [newPartyLocation, setNewPartyLocation] = useState("");
    const [createdParty, setCreatedParty] = useState(null);
    const [creatingPartyLoading, setCreatingPartyLoading] = useState(false);
    const [newPartyCustomerCount, setNewPartyCustomerCount] = useState("1");
    const [selectedParty, setSelectedParty] = useState(null);
    const [closingParty, setClosingParty] = useState(false);
    const [pushPublicKey, setPushPublicKey] = useState("");
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);

    useEffect(() => {
        const storeId = Cookies.get("waiterStoreId");
        const storeName = Cookies.get("waiterStoreName");
        const waiterId = Cookies.get("waiterId");
        const waiterName = Cookies.get("waiterName");

        if (storeId && storeName && waiterId && waiterName) {
            setStoreData({
                storeId,
                storeName,
                name: storeName,
                currency: "ZAR",
            });
            setWaiter({ id: waiterId, name: waiterName });
            setLoggedIn(true);
        }
    }, []);

    useEffect(() => {
    if (!loggedIn) return;

    let cancelled = false;

    axios
        .get(`${serverUrl}/api/v1/push/public-key`)
        .then((response) => {
            if (!cancelled) {
                setPushPublicKey(response.data?.data?.publicKey || "");
            }
        })
        .catch((err) => {
            console.error("Could not load push configuration:", err);
        });

    return () => {
        cancelled = true;
    };
}, [loggedIn]);

async function enablePushNotifications() {
    if (pushLoading) return;

    if (!window.isSecureContext) {
        setNotice("Open Tablewise using its HTTPS address to enable notifications.");
        return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setNotice("This browser does not support Web Push notifications.");
        return;
    }

    if (!("Notification" in window)) {
        setNotice("This browser does not support system notifications.");
        return;
    }

    if (!pushPublicKey) {
        setNotice("Push configuration is not ready. Refresh and try again.");
        return;
    }

    setPushLoading(true);

    try {
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            setNotice(
                permission === "denied"
                    ? "Notifications are blocked. Enable them in your browser or device settings."
                    : "Notification permission was not granted."
            );
            return;
        }

        const registration = await navigator.serviceWorker.register(
            "/service-worker.js"
        );

        await navigator.serviceWorker.ready;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(pushPublicKey),
            });
        }

        await axios.post(`${serverUrl}/api/v1/push/subscribe`, {
            storeId: storeData.storeId,
            waiterId: waiter.id,
            subscription: subscription.toJSON(),
        });

        setPushEnabled(true);
        setNotice("Notifications enabled on this device.");

    } catch (err) {
        console.error("Could not enable push notifications:", err);

        setNotice(
            err.response?.data?.message ||
                "Could not enable notifications. Check HTTPS, permissions and your backend."
        );
    } finally {
        setPushLoading(false);
    }
}

    async function SubmitLogin(e) {
        e.preventDefault();
        setError("");

        try {
            const response = await axios.post(
                `${serverUrl}/api/v1/restaurant/waiter/login`,
                { email, password }
            );

            const data = response.data?.data;

            if (
                !response.data?.success ||
                !data?.waiterId ||
                !data?.restaurantId
            ) {
                alert("Invalid login credentials.");
                return;
            }

            Cookies.set("waiterStoreId", data.restaurantId, { expires: 1 });
            Cookies.set("waiterStoreName", data.restaurantName, { expires: 1 });
            Cookies.set("waiterId", data.waiterId, { expires: 1 });
            Cookies.set("waiterName", data.waiterName, { expires: 1 });

            setStoreData({
                storeId: data.restaurantId,
                storeName: data.restaurantName,
                name: data.restaurantName,
                currency: "ZAR",
            });

            setWaiter({
                id: data.waiterId,
                name: data.waiterName,
            });

            setPassword("");
            setLoggedIn(true);
        } catch (err) {
            console.error("Waiter login failed:", err);
            alert(err.response?.data?.message || "Invalid email or password.");
        }
    }

    function logout() {
        Cookies.remove("waiterStoreId");
        Cookies.remove("waiterStoreName");
        Cookies.remove("waiterId");
        Cookies.remove("waiterName");

        setLoggedIn(false);
        setStoreData(null);
        setWaiter(null);
        setOrders([]);
        setRequests([]);
        setParties([]);
        setSearch("");
        setError("");
        setNotice("");
        setEmail("");
        setPassword("");
        setSelectedParty(null);
        setCreatedParty(null);
    }

    const formatCurrency = (value) =>
        (Number(value) || 0).toLocaleString("en-ZA", {
            style: "currency",
            currency: storeData?.currency || "ZAR",
        });

    const formatTime = (value) => {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "—";

        return date.toLocaleTimeString("en-ZA", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getInitials = (name) =>
        String(name || "W")
            .split(" ")
            .map((part) => part[0] || "")
            .join("")
            .slice(0, 2)
            .toUpperCase();

    const getCustomerCount = (party) =>
        party.customerCount ?? party.customers?.length ?? 0;

    const partyNeedsHelp = (party) =>
        requests.some(
            (request) =>
                String(request.partyId) === String(party.id) &&
                ["Open", "Pending"].includes(request.status)
        );

    const getPartyDisplayStatus = (party) => {
        if (partyNeedsHelp(party)) return "Needs help";
        return party.status === "Needs help" ? "Active" : party.status;
    };

    const getStatusClass = (status) => {
        if (
            ["Confirmed", "Completed", "Acknowledged", "Closed"].includes(status)
        ) {
            return "status-green";
        }

        if (
            ["Pending", "Open", "Needs help", "Active"].includes(status)
        ) {
            return "status-yellow";
        }

        return "status-red";
    };

    const fetchDashboard = useCallback(async () => {
        if (!loggedIn || !storeData?.storeId || !waiter?.id) return;

        setLoading(true);
        setError("");

        try {
            const storeId = storeData.storeId;

            const [
                partiesResponse,
                ordersResponse,
                requestsResponse,
            ] = await Promise.all([
                axios.get(`${serverUrl}/api/v1/parties/${storeId}`),
                axios.get(`${serverUrl}/api/v1/orders/${storeId}`),
                axios.get(`${serverUrl}/api/v1/requests/${storeId}`),
            ]);

            const allParties = Array.isArray(partiesResponse.data?.data)
                ? partiesResponse.data.data
                : [];

            const allOrders = Array.isArray(ordersResponse.data?.data)
                ? ordersResponse.data.data
                : [];

            const allRequests = Array.isArray(requestsResponse.data?.data)
                ? requestsResponse.data.data
                : [];

            const assignedParties = allParties.filter(
                (party) => String(party.waiterId) === String(waiter.id)
            );

            const assignedPartyIds = new Set(
                assignedParties.map((party) => String(party.id))
            );

            setParties(assignedParties);

            setOrders(
                allOrders.filter((order) =>
                    assignedPartyIds.has(String(order.partyId))
                )
            );

            setRequests(
                allRequests.filter((request) =>
                    assignedPartyIds.has(String(request.partyId))
                )
            );

            setSelectedParty((current) => {
                if (!current) return current;

                return (
                    assignedParties.find(
                        (party) => String(party.id) === String(current.id)
                    ) || current
                );
            });
        } catch (err) {
            console.error("Failed to load waiter dashboard:", err);
            setError(
                err.response?.data?.message ||
                    "Unable to load your dashboard. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }, [loggedIn, storeData?.storeId, waiter?.id]);

    useEffect(() => {
        if (loggedIn && waiter?.id) {
            fetchDashboard();
        }
    }, [loggedIn, waiter?.id, fetchDashboard]);

    useEffect(() => {
    if (
        !loggedIn ||
        !pushPublicKey ||
        !storeData?.storeId ||
        !waiter?.id ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
    ) {
        return;
    }

    let cancelled = false;

    async function restoreSubscription() {
        try {
            const registration = await navigator.serviceWorker.register(
                "/service-worker.js"
            );

            await navigator.serviceWorker.ready;

            const subscription =
                await registration.pushManager.getSubscription();

            if (!subscription || cancelled) return;

            await axios.post(`${serverUrl}/api/v1/push/subscribe`, {
                storeId: storeData.storeId,
                waiterId: waiter.id,
                subscription: subscription.toJSON(),
            });

            if (!cancelled) setPushEnabled(true);
        } catch (err) {
            console.error("Could not restore push subscription:", err);
        }
    }

    restoreSubscription();

    return () => {
        cancelled = true;
    };
}, [loggedIn, pushPublicKey, storeData?.storeId, waiter?.id]);

    async function createParty(e) {
        e.preventDefault();

        const customerCount = Number(newPartyCustomerCount);

        if (
            !newPartyLocation.trim() ||
            !Number.isInteger(customerCount) ||
            customerCount < 1 ||
            creatingPartyLoading
        ) {
            return;
        }

        setCreatingPartyLoading(true);
        setError("");

        try {
            const response = await axios.post(
                `${serverUrl}/api/v1/parties/${storeData.storeId}`,
                {
                    location: newPartyLocation.trim(),
                    customerCount,
                    customers: [],
                    waiterId: waiter.id,
                    waiterName: waiter.name,
                }
            );

            if (!response.data?.success || !response.data?.data?.id) {
                throw new Error("The party could not be created.");
            }

            const party = response.data.data;

            const customerUrl = new URL("/party", window.location.origin);
            customerUrl.searchParams.set("storeId", storeData.storeId);
            customerUrl.searchParams.set("partyId", party.id);

            setCreatedParty({
                ...party,
                customerCount: party.customerCount ?? customerCount,
                qrUrl: customerUrl.toString(),
            });

            setNewPartyLocation("");
            setNewPartyCustomerCount("1");
            setCreatingParty(false);
            setNotice(`Party ${party.id} created successfully.`);

            await fetchDashboard();
        } catch (err) {
            console.error("Failed to create party:", err);

            setError(
                err.response?.data?.error?.message ||
                    err.response?.data?.message ||
                    err.message ||
                    "Could not create the party. Please try again."
            );
        } finally {
            setCreatingPartyLoading(false);
        }
    }

    // FIX: Copy customer links even when the Clipboard API is unavailable.
    async function copyCustomerLink() {
        const url = createdParty?.qrUrl;

        if (!url) return;

        try {
            if (
                window.isSecureContext &&
                navigator.clipboard?.writeText
            ) {
                await navigator.clipboard.writeText(url);
            } else {
                // Fallback for HTTP LAN addresses such as 192.168.0.161.
                const textArea = document.createElement("textarea");

                textArea.value = url;
                textArea.setAttribute("readonly", "");
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";

                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                const copied = document.execCommand("copy");

                document.body.removeChild(textArea);

                if (!copied) {
                    throw new Error("The browser blocked clipboard access.");
                }
            }

            setNotice("Customer link copied.");
        } catch (err) {
            console.error("Failed to copy customer link:", err);

            // Manual fallback if the browser blocks both methods.
            window.prompt("Copy this customer link:", url);
        }
    }

    const activeParties = parties.filter((party) =>
        ["Active", "Needs help"].includes(party.status)
    );

    const pendingOrders = orders.filter(
        (order) => order.status === "Pending"
    );

    const openRequests = requests.filter((request) =>
        ["Open", "Pending"].includes(request.status)
    );

    const waiterCalls = openRequests.filter(
        (request) => request.type === "Call waiter"
    );

    const openBillValue = activeParties.reduce((total, party) => {
        const partyTotal = orders
            .filter(
                (order) =>
                    String(order.partyId) === String(party.id) &&
                    order.status !== "Rejected"
            )
            .reduce(
                (sum, order) => sum + (Number(order.total) || 0),
                0
            );

        return total + partyTotal;
    }, 0);

    const normalizedSearch = search.trim().toLowerCase();

    const filteredOrders = orders.filter((order) => {
        const text = [
            order.id,
            order.partyId,
            order.customerName,
            order.status,
            ...(order.items || []).map((item) => item.name),
        ]
            .join(" ")
            .toLowerCase();

        return text.includes(normalizedSearch);
    });

    const filteredParties = parties.filter((party) => {
        const customers = (party.customers || []).map((customer) =>
            typeof customer === "string"
                ? customer
                : `${customer.firstName || ""} ${customer.lastName || ""}`
        );

        const text = [
            party.id,
            party.location,
            party.waiterName,
            party.status,
            party.customerCount,
            ...customers,
        ]
            .join(" ")
            .toLowerCase();

        return text.includes(normalizedSearch);
    });

    const filteredRequests = requests.filter((request) => {
        const text = [
            request.id,
            request.partyId,
            request.type,
            request.status,
        ]
            .join(" ")
            .toLowerCase();

        return text.includes(normalizedSearch);
    });

    async function updateOrderStatus(order, status, reason = "") {
        setSubmitting(true);

        try {
            await axios.patch(
                `${serverUrl}/api/v1/orders/${storeData.storeId}/${order.id}`,
                {
                    status,
                    rejectionReason: reason,
                }
            );

            setOrders((current) =>
                current.map((item) =>
                    String(item.id) === String(order.id)
                        ? { ...item, status, rejectionReason: reason }
                        : item
                )
            );

            setNotice(
                status === "Confirmed"
                    ? `Order ${order.id} confirmed.`
                    : `Order ${order.id} rejected.`
            );

            setRejectingOrder(null);
            setRejectionReason("");
        } catch (err) {
            console.error("Unable to update order:", err);

            setNotice(
                err.response?.data?.message ||
                    "Could not update the order. Check your backend route."
            );
        } finally {
            setSubmitting(false);
        }
    }

    async function rejectOrder(e) {
        e.preventDefault();

        if (!rejectingOrder || !rejectionReason.trim()) return;

        await updateOrderStatus(
            rejectingOrder,
            "Rejected",
            rejectionReason.trim()
        );
    }

    async function acknowledgeRequest(request) {
        try {
            const response = await axios.patch(
                `${serverUrl}/api/v1/requests/${storeData.storeId}/${request.id}/acknowledge`
            );

            const updatedRequest = response.data.data;

            setRequests((current) =>
                current.map((item) =>
                    String(item.id) === String(request.id)
                        ? { ...item, ...updatedRequest }
                        : item
                )
            );

            setNotice(
                `${request.type} for Party #${request.partyId} acknowledged.`
            );
        } catch (err) {
            console.error(
                "Unable to acknowledge request:",
                err.response?.data || err
            );

            setNotice(
                err.response?.data?.message ||
                    "Could not acknowledge the request. Please try again."
            );
        }
    }

    const getPartyOrders = (party) =>
        orders.filter(
            (order) =>
                String(order.partyId) === String(party.id) &&
                order.status !== "Rejected"
        );

    const getBillTotal = (partyOrders) =>
        partyOrders.reduce(
            (total, order) => total + (Number(order.total) || 0),
            0
        );

    const getIndividualBills = (partyOrders) => {
        const bills = new Map();

        partyOrders.forEach((order) => {
            const customerName = order.customerName?.trim() || "Unassigned guest";

            if (!bills.has(customerName)) {
                bills.set(customerName, []);
            }

            bills.get(customerName).push(order);
        });

        return Array.from(bills, ([customerName, customerOrders]) => ({
            customerName,
            orders: customerOrders,
            total: getBillTotal(customerOrders),
        }));
    };

    async function closeParty(party) {
        if (
            !window.confirm(
                `Close Party #${party.id}? This will mark the session as completed.`
            ) ||
            closingParty
        ) {
            return;
        }

        setClosingParty(true);
        setError("");

        try {
            const response = await axios.patch(
                `${serverUrl}/api/v1/parties/${storeData.storeId}/${party.id}/close`
            );

            const updatedParty = response.data?.data;

            setParties((current) =>
                current.map((item) =>
                    String(item.id) === String(party.id)
                        ? {
                              ...item,
                              ...(updatedParty || {}),
                              status: updatedParty?.status || "Completed",
                          }
                        : item
                )
            );

            setSelectedParty(null);
            setNotice(`Party #${party.id} has been closed.`);

            await fetchDashboard();
        } catch (err) {
            console.error("Failed to close party:", err);

            setError(
                err.response?.data?.message ||
                    "Could not close this party. Make sure the backend close-party endpoint exists."
            );
        } finally {
            setClosingParty(false);
        }
    }

    if (!loggedIn) {
        return (
            <div className="login-page">
                <form className="login-form" onSubmit={SubmitLogin}>
                    <div className="brand-lockup">
                        <span className="brand-mark">t.</span>
                        <span>
                            <span className="brand-name">tablewise</span>
                            <br />
                            <span className="brand-sub">WAITER WORKSPACE</span>
                        </span>
                    </div>

                    <h1>Waiter login</h1>
                    <p>Sign in to manage your assigned tables and orders.</p>

                    <label htmlFor="waiter-email">Email address</label>
                    <input
                        id="waiter-email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="username"
                        required
                    />

                    <label htmlFor="waiter-password">Password</label>
                    <input
                        id="waiter-password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                    />

                    <button className="btn btn-primary" type="submit">
                        Login
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <a className="brand-lockup" href="#dashboard">
                    <span className="brand-mark">t.</span>
                    <span>
                        <span className="brand-name">tablewise</span>
                        <br />
                        <span className="brand-sub">SERVICE WORKSPACE</span>
                    </span>
                </a>

                <div className="nav-label">Service</div>

                <nav className="nav">
                    <a className="active" href="#dashboard">
                        <span className="nav-icon">▦</span>My dashboard
                    </a>
                    <a href="#parties">
                        <span className="nav-icon">◉</span>My parties
                    </a>
                    <a href="#orders">
                        <span className="nav-icon">≡</span>Incoming orders
                        <span className="pill">{pendingOrders.length}</span>
                    </a>
                    <a href="#requests">
                        <span className="nav-icon">♧</span>Customer requests
                        <span className="pill">{openRequests.length}</span>
                    </a>
                    <a href="#history">
                        <span className="nav-icon">◷</span>Session history
                    </a>
                </nav>

                <div className="sidebar-bottom">
                    <div className="help-card">
                        <strong>Quick reminder</strong>
                        <p>Confirm orders only after entering them into the restaurant till.</p>
                    </div>
                    <button className="btn btn-secondary" type="button" onClick={logout}>
                        Log out
                    </button>
                </div>
            </aside>

            <main className="main">
                <header className="topbar">
                    <div className="search">
                        <span>⌕</span>
                        <input
                            type="search"
                            aria-label="Search parties, orders and requests"
                            placeholder="Search parties, orders, customers…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    <div className="top-actions">
                        <button
                            className="icon-button"
                            type="button"
                            aria-label="Notifications"
                            onClick={() =>
                                setNotice(`${openRequests.length} open customer requests.`)
                            }
                        >
                            ♧{openRequests.length > 0 && <i className="notification-dot" />}
                        </button>

                        <div className="user">
                            <div className="avatar">{getInitials(waiter?.name)}</div>
                            <div className="user-text">
                                <strong>{waiter?.name || "Waiter"}</strong>
                                <small>{storeData?.storeName || "Restaurant"}</small>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="content" id="dashboard">
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
                            <h1>Your service dashboard</h1>
                            <p>Keep track of your parties, orders and customer requests.</p>
                        </div>

<div className="heading-actions">
    <button
        className="btn btn-secondary"
        type="button"
        onClick={enablePushNotifications}
        disabled={pushLoading || !pushPublicKey || pushEnabled}
    >
        {pushLoading
            ? "Enabling…"
            : pushEnabled
              ? "✓ Notifications enabled"
              : "Enable notifications"}
    </button>

    <button
        className="btn btn-secondary"
        type="button"
        onClick={fetchDashboard}
        disabled={loading}
    >
        {loading ? "Refreshing…" : "↻ Refresh"}
    </button>
</div>
                    </div>

                    {error && <div className="error-message" role="alert">{error}</div>}

                    {notice && (
                        <div className="notice-message" role="status">
                            {notice}
                            <button type="button" onClick={() => setNotice("")}>×</button>
                        </div>
                    )}

                    {loading && <p className="small">Loading your dashboard…</p>}

                    <section className="grid stats-grid">
                        <article className="card stat-card">
                            <div className="stat-top">
                                <span>Active parties</span><span className="stat-icon">◉</span>
                            </div>
                            <div className="stat-value">{activeParties.length}</div>
                            <div className="stat-foot">Assigned to you</div>
                        </article>

                        <article className="card stat-card">
                            <div className="stat-top">
                                <span>New orders</span><span className="stat-icon">≡</span>
                            </div>
                            <div className="stat-value">{pendingOrders.length}</div>
                            <div className="stat-foot">Need your attention</div>
                        </article>

                        <article className="card stat-card">
                            <div className="stat-top">
                                <span>Waiter calls</span><span className="stat-icon">♧</span>
                            </div>
                            <div className="stat-value">{waiterCalls.length}</div>
                            <div className="stat-foot">Open waiter calls</div>
                        </article>

                        <article className="card stat-card">
                            <div className="stat-top">
                                <span>Open bill value</span><span className="stat-icon">R</span>
                            </div>
                            <div className="stat-value">{formatCurrency(openBillValue)}</div>
                            <div className="stat-foot">Not payment-confirmed</div>
                        </article>
                    </section>

                    <section className="grid dashboard-grid">
                        <article className="card" id="orders">
                            <div className="card-header">
                                <h2>Incoming orders</h2>
                                <span className="status status-yellow">{pendingOrders.length} pending</span>
                            </div>

                            <div className="card-body">
                                {filteredOrders.length ? (
                                    filteredOrders.map((order) => (
                                        <div className="order-row" key={order.id}>
                                            <div className="order-time">{formatTime(order.createdAt)}</div>

                                            <div className="order-copy">
                                                <strong>
                                                    Party #{order.partyId} · {order.customerName || "Guest"}
                                                </strong>

                                                <p>
                                                    {(order.items || []).map((item, index) => (
                                                        <span key={`${order.id}-${item.productId || item.name}-${index}`}>
                                                            {item.quantity || 1} × {item.name}
                                                            {index < order.items.length - 1 ? " · " : ""}
                                                        </span>
                                                    ))}
                                                    <br />
                                                    <span className="money">{formatCurrency(order.total)}</span>
                                                </p>

                                                <div className="order-actions">
                                                    {order.status === "Pending" && (
                                                        <>
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                type="button"
                                                                disabled={submitting}
                                                                onClick={() => updateOrderStatus(order, "Confirmed")}
                                                            >
                                                                Confirm after till entry
                                                            </button>
                                                            <button
                                                                className="btn btn-secondary btn-sm"
                                                                type="button"
                                                                disabled={submitting}
                                                                onClick={() => {
                                                                    setRejectingOrder(order);
                                                                    setRejectionReason("");
                                                                }}
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    <span className={`status ${getStatusClass(order.status)}`}>
                                                        {order.status}
                                                    </span>
                                                </div>

                                                {order.status === "Rejected" && order.rejectionReason && (
                                                    <small>Reason: {order.rejectionReason}</small>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="empty-state">
                                        {search ? "No orders match your search." : "No orders assigned to you."}
                                    </p>
                                )}
                            </div>
                        </article>

                        <article className="card" id="requests">
                            <div className="card-header">
                                <h2>Customer requests</h2>
                                <span className="status status-red">{openRequests.length} open</span>
                            </div>

                            <div className="card-body">
                                <div className="list">
                                    {filteredRequests.length ? (
                                        filteredRequests.map((request) => (
                                            <div className="list-row" key={request.id}>
                                                <div className="stat-icon">
                                                    {request.type === "Call waiter"
                                                        ? "♧"
                                                        : request.type === "Request bill"
                                                          ? "▤"
                                                          : "◷"}
                                                </div>

                                                <div className="grow">
                                                    <strong>Party #{request.partyId} · {request.type}</strong>
                                                    <small>
                                                        {request.createdAt
                                                            ? `Requested ${formatTime(request.createdAt)}`
                                                            : request.status}
                                                    </small>
                                                </div>

                                                {["Open", "Pending"].includes(request.status) ? (
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        type="button"
                                                        onClick={() => acknowledgeRequest(request)}
                                                    >
                                                        Acknowledge
                                                    </button>
                                                ) : (
                                                    <span className={`status ${getStatusClass(request.status)}`}>
                                                        {request.status}
                                                    </span>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="empty-state">No customer requests found.</p>
                                    )}
                                </div>
                            </div>
                        </article>
                    </section>

                    <section className="card" id="parties">
                        <div className="card-header">
                            <h2>My parties</h2>
                            <span className="status status-yellow">{activeParties.length} active</span>
                            <button
                                className="btn btn-primary"
                                type="button"
                                onClick={() => {
                                    setNewPartyLocation("");
                                    setCreatingParty(true);
                                }}
                            >
                                + New party
                            </button>
                        </div>

                        <div className="card-body">
                            {filteredParties.length ? (
                                <div className="list">
                                    {filteredParties.map((party) => (
                                        <div
                                            className="list-row party-clickable"
                                            key={party.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedParty(party)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    setSelectedParty(party);
                                                }
                                            }}
                                        >
                                            <div className="stat-icon">◉</div>
                                            <div className="grow">
                                                <strong>
                                                    Party #{party.id}{party.location ? ` · ${party.location}` : ""}
                                                </strong>
                                                <small>
                                                    {getCustomerCount(party)} customers · Started {formatTime(party.createdAt)}
                                                </small>
                                                <small>Click to view bills and manage this party</small>
                                            </div>
                                            <span className={`status ${getStatusClass(getPartyDisplayStatus(party))}`}>
                                                {getPartyDisplayStatus(party)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-state">
                                    {search ? "No parties match your search." : "No parties assigned to you."}
                                </p>
                            )}
                        </div>
                    </section>

                    <section className="card" id="history">
                        <div className="card-header"><h2>Session history</h2></div>
                        <div className="card-body">
                            {parties.filter((party) => !["Active", "Needs help"].includes(party.status)).length ? (
                                <div className="list">
                                    {parties
                                        .filter((party) => !["Active", "Needs help"].includes(party.status))
                                        .map((party) => (
                                            <div
                                                className="list-row party-clickable"
                                                key={party.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => setSelectedParty(party)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        setSelectedParty(party);
                                                    }
                                                }}
                                            >
                                                <div className="stat-icon">◷</div>
                                                <div className="grow">
                                                    <strong>Party #{party.id}</strong>
                                                    <small>
                                                        {getCustomerCount(party)} customers{party.location ? ` · ${party.location}` : ""}
                                                    </small>
                                                </div>
                                                <span className={`status ${getStatusClass(party.status)}`}>
                                                    {party.status}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <p className="empty-state">No completed parties yet.</p>
                            )}
                        </div>
                    </section>
                </div>
            </main>

            {rejectingOrder && (
                <div className="modal-overlay">
                    <form className="modal card" onSubmit={rejectOrder}>
                        <div className="card-header">
                            <h2>Reject order #{rejectingOrder.id}</h2>
                            <button
                                type="button"
                                className="icon-button"
                                onClick={() => setRejectingOrder(null)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="card-body">
                            <label htmlFor="rejection-reason">Reason for rejection</label>
                            <textarea
                                id="rejection-reason"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Explain why this order cannot be accepted"
                                required
                            />

                            <div className="order-actions">
                                <button
                                    className="btn btn-secondary"
                                    type="button"
                                    onClick={() => setRejectingOrder(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    type="submit"
                                    disabled={submitting || !rejectionReason.trim()}
                                >
                                    {submitting ? "Rejecting…" : "Reject order"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {selectedParty && (() => {
                const party = selectedParty;
                const partyOrders = getPartyOrders(party);

                const getOrderBillingPreference = (order) =>
                    String(order.billingPreference || "").toLowerCase().trim();

                const combinedOrders = partyOrders.filter(
                    (order) => getOrderBillingPreference(order) === "combined"
                );

                const separateOrders = partyOrders.filter(
                    (order) => getOrderBillingPreference(order) === "separate"
                );

                const unclassifiedOrders = partyOrders.filter(
                    (order) => !["combined", "separate"].includes(getOrderBillingPreference(order))
                );

                const individualBills = getIndividualBills(separateOrders);
                const combinedTotal = getBillTotal(combinedOrders);
                const isClosed = !["Active", "Needs help"].includes(party.status);

                return (
                    <div
                        className="modal-overlay"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setSelectedParty(null);
                        }}
                    >
                        <div className="modal card party-details-modal">
                            <div className="card-header">
                                <div>
                                    <h2>Party #{party.id}</h2>
                                    <p>{party.location || "No location specified"} · {getCustomerCount(party)} customers</p>
                                </div>
                                <button
                                    type="button"
                                    className="icon-button"
                                    aria-label="Close party details"
                                    onClick={() => setSelectedParty(null)}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="card-body">
                                <details className="bill-dropdown combined-bill-dropdown">
                                    <summary className="bill-dropdown-summary">
                                        <div className="bill-dropdown-heading">
                                            <span className="bill-dropdown-icon">👥</span>
                                            <div>
                                                <strong>Combined bill</strong>
                                                <small>
                                                    {combinedOrders.length} {combinedOrders.length === 1 ? "order" : "orders"} · Shared by customers
                                                </small>
                                            </div>
                                        </div>
                                        <div className="bill-dropdown-total">
                                            <strong>{formatCurrency(combinedTotal)}</strong>
                                            <span className="bill-chevron">⌄</span>
                                        </div>
                                    </summary>

                                    <div className="bill-dropdown-content">
                                        {combinedOrders.length ? (
                                            <>
                                                {combinedOrders.map((order) => (
                                                    <div className="bill-order-card" key={order.id}>
                                                        <div className="bill-order-header">
                                                            <div>
                                                                <strong>{order.customerName?.trim() || "Guest"}</strong>
                                                                <small>Order #{order.id}</small>
                                                            </div>
                                                            <div className="bill-order-meta">
                                                                <span className={`bill-status bill-status-${String(order.status || "unknown").toLowerCase()}`}>
                                                                    {order.status}
                                                                </span>
                                                                <strong>{formatCurrency(order.total)}</strong>
                                                            </div>
                                                        </div>

                                                        {order.items?.length > 0 && (
                                                            <div className="bill-order-items">
                                                                {order.items.map((item, index) => (
                                                                    <div className="bill-item-row" key={`${order.id}-${index}`}>
                                                                        <span className="bill-item-quantity">{item.quantity || 1}×</span>
                                                                        <span className="bill-item-name">{item.name}</span>
                                                                        <span className="bill-item-price">
                                                                            {formatCurrency(
                                                                                item.price != null
                                                                                    ? (Number(item.price) || 0) * (Number(item.quantity) || 1)
                                                                                    : (order.items?.length === 1 ? Number(order.total) || 0 : 0)
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                <div className="bill-dropdown-footer">
                                                    <span>Combined bill total</span>
                                                    <strong>{formatCurrency(combinedTotal)}</strong>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="bill-empty">No orders have been assigned to the combined bill.</p>
                                        )}
                                    </div>
                                </details>

                                <section className="individual-bills-section">
                                    <div className="individual-bills-heading">
                                        <div>
                                            <h3>Individual bills</h3>
                                            <p>Separate bills for customers paying individually.</p>
                                        </div>
                                        <span className="bill-count-badge">{individualBills.length}</span>
                                    </div>

                                    {individualBills.length ? (
                                        <div className="individual-bills-list">
                                            {individualBills.map((bill, index) => (
                                                <details
                                                    className="bill-dropdown individual-bill-dropdown"
                                                    key={`${bill.customerName}-${index}`}
                                                >
                                                    <summary className="bill-dropdown-summary">
                                                        <div className="bill-dropdown-heading">
                                                            <span className="bill-dropdown-icon individual-icon">
                                                                {String(bill.customerName || "G").trim().charAt(0).toUpperCase()}
                                                            </span>
                                                            <div>
                                                                <strong>{bill.customerName}</strong>
                                                                <small>
                                                                    {bill.orders.length} {bill.orders.length === 1 ? "order" : "orders"}
                                                                </small>
                                                            </div>
                                                        </div>

                                                        <div className="bill-dropdown-total">
                                                            <strong>{formatCurrency(bill.total)}</strong>
                                                            <span className="bill-chevron">⌄</span>
                                                        </div>
                                                    </summary>

                                                    <div className="bill-dropdown-content individual-content">
                                                        {bill.orders.map((order) => (
                                                            <div className="bill-order-card" key={order.id}>
                                                                <div className="bill-order-header">
                                                                    <div>
                                                                        <strong>Order #{order.id}</strong>
                                                                        <small>{order.status}</small>
                                                                    </div>
                                                                    <strong>{formatCurrency(order.total)}</strong>
                                                                </div>

                                                                {order.items?.length > 0 && (
                                                                    <div className="bill-order-items">
                                                                        {order.items.map((item, itemIndex) => (
                                                                            <div className="bill-item-row" key={`${order.id}-${itemIndex}`}>
                                                                                <span className="bill-item-quantity">{item.quantity || 1}×</span>
                                                                                <span className="bill-item-name">{item.name}</span>
                                                                                <span className="bill-item-price">
                                                                                    {formatCurrency(
                                                                                        item.price != null
                                                                                            ? (Number(item.price) || 0) * (Number(item.quantity) || 1)
                                                                                            : (order.items?.length === 1 ? Number(order.total) || 0 : 0)
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}

                                                        <div className="bill-dropdown-footer">
                                                            <span>{bill.customerName}'s total</span>
                                                            <strong>{formatCurrency(bill.total)}</strong>
                                                        </div>
                                                    </div>
                                                </details>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bill-empty individual-empty">
                                            <strong>No individual bills yet</strong>
                                            <p>Orders marked as separate billing will appear here.</p>
                                        </div>
                                    )}
                                </section>

                                {unclassifiedOrders.length > 0 && (
                                    <div className="bill-empty">
                                        <strong>
                                            {unclassifiedOrders.length} {unclassifiedOrders.length === 1 ? "order has" : "orders have"} no valid billing preference
                                        </strong>
                                        <p>
                                            These orders were not included in either bill. Check that the API saves and returns order.billingPreference as "combined" or "separate".
                                        </p>
                                        {unclassifiedOrders.map((order) => (
                                            <p key={order.id}>
                                                Order #{order.id} — {order.customerName || "Guest"} — {String(order.billingPreference || "missing")}
                                            </p>
                                        ))}
                                    </div>
                                )}

                                <p className="small">Billing preference is classified per order/customer.</p>

                                <div className="order-actions party-modal-actions">
                                    <button
                                        className="btn btn-secondary"
                                        type="button"
                                        onClick={fetchDashboard}
                                        disabled={loading}
                                    >
                                        Refresh bills
                                    </button>

                                    {!isClosed && (
                                        <button
                                            className="btn btn-primary"
                                            type="button"
                                            onClick={() => closeParty(party)}
                                            disabled={closingParty}
                                        >
                                            {closingParty ? "Closing party…" : "Close party"}
                                        </button>
                                    )}
                                </div>

                                {isClosed && <p className="small">This party has already been closed.</p>}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {creatingParty && (
                <div className="modal-overlay">
                    <form className="modal card" onSubmit={createParty}>
                        <div className="card-header">
                            <h2>Create new party</h2>
                            <button
                                type="button"
                                className="icon-button"
                                onClick={() => setCreatingParty(false)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="card-body">
                            <label htmlFor="party-location">Table number or location</label>
                            <input
                                id="party-location"
                                type="text"
                                value={newPartyLocation}
                                onChange={(e) => setNewPartyLocation(e.target.value)}
                                placeholder="e.g. Table 4 or Patio 2"
                                required
                                autoFocus
                            />

                            <label htmlFor="party-customer-count">Number of customers</label>
                            <input
                                id="party-customer-count"
                                type="number"
                                min="1"
                                step="1"
                                value={newPartyCustomerCount}
                                onChange={(e) => setNewPartyCustomerCount(e.target.value)}
                                required
                            />

                            <div className="order-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setCreatingParty(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={creatingPartyLoading}
                                >
                                    {creatingPartyLoading ? "Creating…" : "Create party"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {createdParty && (
                <div className="modal-overlay">
                    <div className="modal card party-qr-modal">
                        <div className="card-header">
                            <h2>Party created!</h2>
                            <button
                                type="button"
                                className="icon-button"
                                onClick={() => setCreatedParty(null)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="card-body party-qr-content">
                            <p>Give your customers this QR code to scan and open their restaurant session.</p>

                            <div className="party-qr-code">
                                <QRCodeSVG
                                    value={createdParty.qrUrl}
                                    size={240}
                                    level="H"
                                    includeMargin
                                />
                            </div>

                            <h3>Party #{createdParty.id}</h3>
                            <p><strong>Location:</strong> {createdParty.location}</p>
                            <p><strong>Customers:</strong> {createdParty.customerCount}</p>
                            <p><strong>Waiter:</strong> {createdParty.waiterName}</p>

                            <div className="order-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={copyCustomerLink}
                                >
                                    Copy customer link
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => window.print()}
                                >
                                    Print QR code
                                </button>
                            </div>

                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setCreatedParty(null)}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Waiter;