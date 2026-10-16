
import { useState } from "react";

export default function PushTest() {
    const [message, setMessage] = useState("");

    async function testNotification() {
        try {
            if (!("serviceWorker" in navigator)) {
                setMessage("Service workers are not supported.");
                return;
            }

            const permission = await Notification.requestPermission();

            if (permission !== "granted") {
                setMessage("Notification permission was not granted.");
                return;
            }

            const registration = await navigator.serviceWorker.ready;

            await registration.showNotification("Tablewise test", {
                body: "Testing notification sound and vibration.",
                icon: "/logo192.png",
                vibrate: [200, 100, 200, 100, 300],
                requireInteraction: true,
                tag: "tablewise-direct-test",
            });

            setMessage("Test notification sent. Check your phone.");
        } catch (error) {
            console.error(error);
            setMessage(`Test failed: ${error.message}`);
        }
    }

    return (
        <div style={{ padding: 20 }}>
            <button onClick={testNotification}>
                Test notification
            </button>
            <p>{message}</p>
        </div>
    );
}
