import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'
import { auth } from '@/lib/firebase'

let debounceTimer = null

const getEntryQty = (entry) => {
    if (typeof entry === 'number') return entry
    return entry?.quantity || 0
}

const getCartTotalQty = (cartItems = {}) => {
    return Object.values(cartItems).reduce((acc, entry) => acc + (getEntryQty(entry) || 0), 0)
}

export const uploadCart = createAsyncThunk('cart/uploadCart', 
    async ({ getToken } = {}, thunkAPI) => {
        try {
            const { cartItems } = thunkAPI.getState().cart;

            let token = null
            if (typeof getToken === 'function') {
                token = await getToken();
            } else if (auth?.currentUser) {
                token = await auth.currentUser.getIdToken();
            }

            if (!token) {
                return { success: true, skipped: true }
            }
            
            const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
            await axios.post('/api/cart', {cart: cartItems}, config)
            return { success: true }
        } catch (error) {
            const details = error?.response?.data;
            const hasDetails = details && (typeof details !== 'object' || Object.keys(details).length > 0);
            if (hasDetails || error?.message) {
                console.warn('[uploadCart] warning:', details || error.message);
            }
            return thunkAPI.rejectWithValue(error.response?.data || { error: 'Failed to upload cart' })
        }
    }
)

export const fetchCart = createAsyncThunk('cart/fetchCart', 
    async ({ getToken }, thunkAPI) => {
        try {
            const token = await getToken()
            const { data } = await axios.get('/api/cart', {headers: { Authorization: `Bearer ${token}` }})
            return data
        } catch (error) {
            return thunkAPI.rejectWithValue(error.response.data)
        }
    }
)


const cartSlice = createSlice({
    name: 'cart',
    initialState: (() => {
        // Guard against SSR: only read localStorage in the browser
        if (typeof window === 'undefined') {
            return { total: 0, cartItems: {} };
        }
        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem('cartState'));
        } catch {}
        return saved || { total: 0, cartItems: {} };
    })(),
    reducers: {
        rehydrateCart: (state, action) => {
            if (typeof window === 'undefined') {
                return;
            }
            let saved = null;
            const raw = localStorage.getItem('cartState');
            try {
                saved = JSON.parse(raw);
            } catch (e) {
                console.error('[cartSlice] Failed to parse cartState:', e);
            }
            
            // ONLY rehydrate if localStorage has items AND current state is empty
            const hasLocalItems = saved && saved.cartItems && Object.keys(saved.cartItems).length > 0;
            const currentIsEmpty = Object.keys(state.cartItems).length === 0;
            const force = !!action?.payload?.force;
            
            if (hasLocalItems && (currentIsEmpty || force)) {
                state.cartItems = saved.cartItems;
                state.total = getCartTotalQty(saved.cartItems || {});
            } else if (force && (!saved || !saved.cartItems)) {
                state.cartItems = {};
                state.total = 0;
            }
        },
        addToCart: (state, action) => {
            const { productId, maxQty, price, variantOptions, offerToken, discountPercent } = action.payload || {}
            const existingEntry = state.cartItems[productId]
            const existingQty = getEntryQty(existingEntry)
            const nextQty = existingQty + 1
            if (typeof maxQty === 'number' && nextQty > Math.max(0, maxQty)) {
                return
            }

            if (typeof existingEntry === 'object' && existingEntry !== null) {
                state.cartItems[productId] = {
                    ...existingEntry,
                    quantity: nextQty,
                    ...(price !== undefined ? { price } : {}),
                    ...(variantOptions !== undefined ? { variantOptions } : {}),
                    ...(offerToken !== undefined ? { offerToken } : {}),
                    ...(discountPercent !== undefined ? { discountPercent } : {}),
                }
            } else if (price !== undefined || variantOptions !== undefined || offerToken !== undefined || discountPercent !== undefined) {
                state.cartItems[productId] = {
                    quantity: nextQty,
                    ...(price !== undefined ? { price } : {}),
                    ...(variantOptions !== undefined ? { variantOptions } : {}),
                    ...(offerToken !== undefined ? { offerToken } : {}),
                    ...(discountPercent !== undefined ? { discountPercent } : {}),
                }
            } else {
                state.cartItems[productId] = nextQty
            }

            state.total = getCartTotalQty(state.cartItems)
        },
        removeFromCart: (state, action) => {
            const { productId } = action.payload
            const existing = state.cartItems[productId]
            const existingQty = getEntryQty(existing)
            if (!existingQty) return
            const nextQty = existingQty - 1
            if (nextQty <= 0) {
                delete state.cartItems[productId]
            } else {
                if (typeof existing === 'object' && existing !== null) {
                    state.cartItems[productId] = {
                        ...existing,
                        quantity: nextQty,
                    }
                } else {
                    state.cartItems[productId] = nextQty
                }
            }
            state.total = getCartTotalQty(state.cartItems)
        },
        deleteItemFromCart: (state, action) => {
            const { productId } = action.payload || {}
            delete state.cartItems[productId]
            state.total = getCartTotalQty(state.cartItems)
        },
        setCartItemQuantity: (state, action) => {
            const { productId, quantity } = action.payload || {}
            if (!productId) return
            const newQty = Number(quantity)
            if (!newQty || newQty <= 0) {
                delete state.cartItems[productId]
            } else {
                const existing = state.cartItems[productId]
                if (typeof existing === 'object' && existing !== null) {
                    state.cartItems[productId] = { ...existing, quantity: newQty }
                } else {
                    state.cartItems[productId] = newQty
                }
            }
            state.total = getCartTotalQty(state.cartItems)
        },
        clearCart: (state) => {
            state.cartItems = {}
            state.total = 0
        },
    },
    extraReducers: (builder)=>{
        builder.addCase(fetchCart.fulfilled, (state, action)=>{
            state.cartItems = action.payload.cart || {}
            state.total = getCartTotalQty(state.cartItems)
        })
    }
})

export const { addToCart, removeFromCart, clearCart, deleteItemFromCart, setCartItemQuantity } = cartSlice.actions

export default cartSlice.reducer
