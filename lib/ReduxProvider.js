"use client";
import { makeStore } from "./store";
import { Provider } from "react-redux";
import React, { useRef, useEffect } from "react";
import { auth } from "./firebase";
import { fetchCart } from "./features/cart/cartSlice";

export default function ReduxProvider({ children }) {
  const storeRef = useRef();
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  useEffect(() => {
    // Rehydrate cart from localStorage on mount
    storeRef.current.dispatch({ type: "cart/rehydrateCart" });

    // Sync cart in real-time across tabs/windows
    const onStorage = (event) => {
      if (!event || event.key === 'cartState') {
        storeRef.current.dispatch({ type: "cart/rehydrateCart", payload: { force: true } });
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        storeRef.current.dispatch(fetchCart({ getToken: async () => user.getIdToken() }));
      }
      // Guests keep their local cart — do not clear on unauthenticated state.
    });

    return () => unsub();
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}
