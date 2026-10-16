import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './Party.css';
import serverUrl from "../../serverUrl";

function Party() {
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('storeId');
    const partyId = params.get('partyId');

    const [billingPreference, setBillingPreference] = useState('');
    const [preferenceSaved, setPreferenceSaved] = useState(false);
    const [activeCategory, setActiveCategory] = useState('Popular');
    const [menuItems, setMenuItems] = useState([]);
    const [party, setParty] = useState(null);
    const [restaurant, setRestaurant] = useState(null);
    const [cart, setCart] = useState([]);
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingPreference, setSavingPreference] = useState(false);
    const [submittingOrder, setSubmittingOrder] = useState(false);
    const [showBasket, setShowBasket] = useState(false);
    const [customerName, setCustomerName] = useState('');


useEffect(() => {
    let cancelled = false;

    async function loadPartyAndMenu() {
        if (!storeId || !partyId) {
            setNotice(
                'This QR code is missing its restaurant or party details. Please ask your waiter for a new QR code.'
            );
            setLoading(false);
            return;
        }

        try {
            // Load the party independently so a menu failure cannot
            // prevent the customer from opening their party.
            const partyResponse = await axios.get(
                `${serverUrl}/api/v1/parties/${storeId}/${partyId}`
            );

            if (cancelled) return;

            const partyData = partyResponse.data?.data;

            if (!partyResponse.data?.success || !partyData) {
                throw new Error('Party details were not returned by the server.');
            }

            setParty(partyData);
            setRestaurant(partyData.restaurant || null);

            const savedChoice = window.sessionStorage.getItem(
                `tablewise-billing-${storeId}-${partyId}`
            );

            if (savedChoice === 'combined' || savedChoice === 'separate') {
                setBillingPreference(savedChoice);
                setPreferenceSaved(true);
            } else if (
                partyData.billingPreference === 'combined' ||
                partyData.billingPreference === 'separate'
            ) {
                setBillingPreference(partyData.billingPreference);
            } else {
                setBillingPreference('combined');
            }

            // Load the menu separately. If it fails, the party can
            // still open and the customer will see an appropriate notice.
            try {
                const menuResponse = await axios.get(
                    `${serverUrl}/api/v1/menu/${storeId}?available=true`
                );

                if (cancelled) return;

                setMenuItems(
                    (menuResponse.data?.data || []).map((item) => ({
                        ...item,
                        id: String(item.id),
                        image: item.imageUrl || item.image || '',
                        alt: item.name
                    }))
                );
            } catch (menuError) {
                if (!cancelled) {
                    setNotice(
                        menuError.response?.data?.error?.message ||
                        'Your party is open, but the menu could not load. Please refresh or ask your waiter for assistance.'
                    );
                }
            }
        } catch (error) {
            if (!cancelled) {
                console.error('Failed to load party:', error);

                setNotice(
                    error.response?.data?.error?.message ||
                    error.message ||
                    'Could not load this party. Please try again.'
                );
            }
        } finally {
            if (!cancelled) setLoading(false);
        }
    }

    loadPartyAndMenu();

    return () => {
        cancelled = true;
    };
}, [storeId, partyId]);


    const categories = useMemo(() => [
        'Popular',
        ...new Set(menuItems.map((item) => item.category).filter(Boolean))
    ], [menuItems]);

    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

    const filteredItems = activeCategory === 'Popular'
        ? menuItems
        : menuItems.filter((item) => item.category === activeCategory);

    function addItem(product) {
        setCart((currentCart) => {
            const existingItem = currentCart.find((item) => item.id === product.id);
            if (existingItem) {
                return currentCart.map((item) =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...currentCart, { ...product, quantity: 1 }];
        });
        setNotice(`${product.name} added to your basket.`);
    }

    function changeQuantity(productId, delta) {
        setCart((currentCart) => currentCart
            .map((item) => item.id === productId
                ? { ...item, quantity: item.quantity + delta }
                : item)
            .filter((item) => item.quantity > 0));
    }

    async function chooseBill(type) {
        if (savingPreference) return;
        setSavingPreference(true);
        setNotice('');

        try {
            await axios.patch(`${serverUrl}/api/v1/parties/${storeId}/${partyId}`, {
                billingPreference: type
            });
            setBillingPreference(type);
            setPreferenceSaved(true);
            window.sessionStorage.setItem(`tablewise-billing-${storeId}-${partyId}`, type);
            setNotice(type === 'combined' ? 'You joined the combined bill.' : 'Your own bill has been selected.');
        } catch (error) {
            setNotice(error.response?.data?.error?.message || 'Could not save your billing preference. Please try again.');
        } finally {
            setSavingPreference(false);
        }
    }

    async function sendRequest(type) {
        try {
            await axios.post(`${serverUrl}/api/v1/requests/${storeId}`, { partyId, type });
            setNotice(type === 'Call waiter' ? 'Your waiter has been notified.' : 'Your bill has been requested.');
        } catch (error) {
            setNotice(error.response?.data?.error?.message || `Could not send your ${type.toLowerCase()} request. Please try again.`);
        }
    }

    function handleWaiterCall() {
        sendRequest('Call waiter');
    }

    function handleBillRequest() {
        sendRequest('Request bill');
    }

    function handleViewBasket() {
        if (cartCount === 0) {
            setNotice('Your basket is empty. Add something from the menu.');
            return;
        }
        setShowBasket(true);
    }

    async function submitOrder() {
        if (!cart.length || submittingOrder) return;
        setSubmittingOrder(true);
        try {
            const response = await axios.post(`${serverUrl}/api/v1/orders/${storeId}`, {
                partyId,
                customerName: customerName.trim() || 'QR Customer',
                billingPreference,
                items: cart.map((item) => ({
                    productId: String(item.id),
                    quantity: item.quantity
                }))
            });

            const orderId = response.data?.data?.id;
            setCart([]);
            setShowBasket(false);
            setCustomerName('');
            setNotice(`Order${orderId ? ` ${orderId}` : ''} submitted successfully. The restaurant will confirm it shortly.`);
        } catch (error) {
            setNotice(error.response?.data?.error?.message || 'Your order could not be submitted. Please try again.');
        } finally {
            setSubmittingOrder(false);
        }
    }

    if (loading) {
        return <div className="mobile-shell"><main className="mobile-content"><p>Loading your party and menu…</p></main></div>;
    }

    if (!party) {
        return <div className="mobile-shell"><main className="mobile-content">
            <div className="card card-pad"><h2>Unable to open this party</h2><p>{notice || 'Check your QR code or ask your waiter for help.'}</p></div>
        </main></div>;
    }

    // The full menu is only rendered after the customer confirms their bill preference.
    if (!preferenceSaved) {
        return (
            <div className="mobile-shell">
                <header className="mobile-top">
                    <div className="mobile-header-row">
                        <div className="mobile-brand">
                            <div className="restaurant-logo">{(restaurant?.name || 'T').charAt(0)}</div>
                            <div>
                                <div className="restaurant-title">{restaurant?.name || 'Tablewise'}</div>
                                <p>{restaurant?.description || restaurant?.location || 'Welcome'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="session-banner">
                        <span className="session-dot"></span>
                        <div className="session-details">
                            <strong>Party #{party.id}</strong>
                            <small>{party.location || 'Restaurant table'} · Waiter: {party.waiterName || 'Not assigned'}</small>
                        </div>
                        <span className="pill">{party.status}</span>
                    </div>
                </header>
                <main className="mobile-content">
                    <div className="customer-hero">
                        <div className="eyebrow">Before you order</div>
                        <h1>How would you like to pay?</h1>
                        <p>Choose your billing preference to continue to the menu.</p>
                    </div>
                    <div className="card card-pad billing-card">
                        <div className="eyebrow billing-heading">Your billing preference</div>
                        <div className="billing-options">
                            <button type="button" className={`billing-option ${billingPreference === 'combined' ? 'selected' : ''}`} onClick={() => setBillingPreference('combined')} aria-pressed={billingPreference === 'combined'}>
                                <span className="radio"></span>
                                <span className="billing-option-copy"><strong>Combined bill</strong><small>Join the shared bill with other customers who choose this option.</small></span>
                            </button>
                            <button type="button" className={`billing-option ${billingPreference === 'separate' ? 'selected' : ''}`} onClick={() => setBillingPreference('separate')} aria-pressed={billingPreference === 'separate'}>
                                <span className="radio"></span>
                                <span className="billing-option-copy"><strong>My own bill</strong><small>Keep your orders on a separate bill just for you.</small></span>
                            </button>
                        </div>
                        <button className="btn btn-primary" type="button" disabled={savingPreference} onClick={() => chooseBill(billingPreference)}>
                            {savingPreference ? 'Saving…' : 'Continue to menu →'}
                        </button>
                    </div>
                    {notice && <div className="customer-notice" role="status"><span>{notice}</span></div>}
                </main>
            </div>
        );
    }
    return (
        <div className="mobile-shell">
            <header className="mobile-top">
                <div className="mobile-header-row">
                    <div className="mobile-brand">
                        <div className="restaurant-logo">{(restaurant?.name || "T").charAt(0)}</div>

                        <div>
                            <div className="restaurant-title">
                                {restaurant?.name || "Restaurant"}
                            </div>
                            <p>{restaurant?.description || restaurant?.location || ""}</p>
                        </div>
                    </div>

                    <button
                        className="icon-button"
                        type="button"
                        aria-label="Your profile"
                        onClick={() =>
                            setNotice('Demo profile menu.')
                        }
                    >
                        ♙
                    </button>
                </div>

                <div className="session-banner">
                    <span className="session-dot"></span>

                    <div className="session-details">
                        <strong>You’re in Party #{party.id}</strong>
                        <small>{party.location || "Restaurant table"} · Waiter: {party.waiterName || "Not assigned"}</small>
                    </div>

                    <span className="pill">{party.status}</span>
                </div>
            </header>

            <main className="mobile-content">
                <div className="customer-hero">
                    <div className="eyebrow">Welcome to Marlow</div>
                    <h1>Good food, good company.</h1>
                    <p>
                        Browse our menu and add your favourites to your order.
                    </p>
                </div>

                {/* Menu categories */}
                <div className="menu-tabs" aria-label="Menu categories">
                    {categories.map((category) => (
                        <button
                            type="button"
                            key={category}
                            className={
                                activeCategory === category ? 'active' : ''
                            }
                            onClick={() => setActiveCategory(category)}
                            aria-pressed={activeCategory === category}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div className="menu-section-heading">
                    <h2>
                        {activeCategory === 'Popular'
                            ? 'Customer favourites'
                            : activeCategory}
                    </h2>

                    <span className="small">
                        {filteredItems.length}{' '}
                        {filteredItems.length === 1 ? 'item' : 'items'}
                    </span>
                </div>

                {/* Menu items */}
                <div className="menu-list">
                    {filteredItems.length > 0 ? (
                        filteredItems.map((item) => (
                            <article className="menu-item" key={item.id}>
                                <img
                                    src={item.image}
                                    alt={item.alt}
                                    loading="lazy"
                                />

                                <div className="menu-item-copy">
                                    <h3>{item.name}</h3>
                                    <p>{item.description}</p>

                                    <div className="menu-item-bottom">
                                        <span className="money">
                                            R{item.price}
                                        </span>

                                        <button
                                            className="add-button"
                                            type="button"
                                            onClick={() => addItem(item)}
                                            aria-label={`Add ${item.name} to basket`}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))
                    ) : (
                        <div className="card card-pad empty-menu">
                            <p>
                                No items available in this category yet.
                            </p>
                        </div>
                    )}
                </div>

                {/* Waiter assistance */}
                <div className="card card-pad waiter-card">
                    <div className="card-header waiter-card-header">
                        <h2>Need your waiter?</h2>
                        <span>♧</span>
                    </div>

                    <p className="waiter-description">
                        Ask for assistance or request your bill.
                    </p>

                    <div className="waiter-actions">
                        <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={handleWaiterCall}
                        >
                            ♧ Call waiter
                        </button>

                        <button
                            className="btn btn-soft"
                            type="button"
                            onClick={handleBillRequest}
                        >
                            ▤ Request bill
                        </button>
                    </div>
                </div>

                {notice && (
                    <div className="customer-notice" role="status">
                        <span>{notice}</span>

                        <button
                            type="button"
                            onClick={() => setNotice('')}
                            aria-label="Dismiss notification"
                        >
                            ×
                        </button>
                    </div>
                )}
            </main>

            {showBasket && (
                <div className="basket-overlay" role="presentation" onClick={(event) => {
                    if (event.target === event.currentTarget) setShowBasket(false);
                }}>
                    <section className="basket-modal card" role="dialog" aria-modal="true" aria-labelledby="basket-title">
                        <div className="basket-modal-header">
                            <div><div className="eyebrow">Your order</div><h2 id="basket-title">Review your basket</h2></div>
                            <button className="icon-button" type="button" onClick={() => setShowBasket(false)} aria-label="Close basket">×</button>
                        </div>
                        <label className="basket-customer-label">
                            Your name (optional)
                            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="e.g. Alex" maxLength={80} />
                        </label>
                        <div className="basket-items">
                            {cart.map((item) => (
                                <div className="basket-item" key={item.id}>
                                    <div className="basket-item-info"><strong>{item.name}</strong><small>R{Number(item.price).toFixed(2)} each</small></div>
                                    <div className="basket-quantity">
                                        <button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={`Remove one ${item.name}`}>−</button>
                                        <span>{item.quantity}</span>
                                        <button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`Add one ${item.name}`}>+</button>
                                    </div>
                                    <strong>R{(item.price * item.quantity).toFixed(2)}</strong>
                                </div>
                            ))}
                        </div>
                        <div className="basket-total"><span>Subtotal</span><strong>R{cartTotal.toFixed(2)}</strong></div>
                        <p className="basket-billing-note">Billing: {billingPreference === 'separate' ? 'Your own bill' : 'Combined bill'}</p>
                        <div className="basket-modal-actions">
                            <button className="btn btn-secondary" type="button" onClick={() => setShowBasket(false)}>Keep browsing</button>
                            <button className="btn btn-primary" type="button" disabled={!cart.length || submittingOrder} onClick={submitOrder}>
                                {submittingOrder ? 'Submitting…' : `Submit order · R${cartTotal.toFixed(2)}`}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {/* Sticky basket */}
            <div className="sticky-cart">
                <div className="sticky-cart-inner">
                    <div className="sticky-cart-summary">
                        <strong>
                            Your basket · {cartCount}{' '}
                            {cartCount === 1 ? 'item' : 'items'}
                        </strong>

                        <small>
                            R{cartTotal.toFixed(2)} subtotal
                        </small>
                    </div>

                    <button
                        className="btn btn-primary"
                        type="button"
                        onClick={handleViewBasket}
                    >
                        View basket →
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Party;
