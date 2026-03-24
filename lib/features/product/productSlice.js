import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'

export const fetchProducts = createAsyncThunk('product/fetchProducts', 
    async ({ storeId, limit = 100, offset = 0, sortBy, fastDelivery, category, includeOutOfStock, all = false }, thunkAPI) => {
        try {
            const params = new URLSearchParams();
            if (storeId) params.append('storeId', storeId);
            if (all) {
                params.append('all', 'true');
            } else if (limit) {
                params.append('limit', limit);
            }
            if (offset) params.append('offset', offset);
            if (sortBy) params.append('sortBy', sortBy);
            if (fastDelivery) params.append('fastDelivery', fastDelivery);
            if (category) params.append('category', category);
            if (includeOutOfStock) params.append('includeOutOfStock', includeOutOfStock);
            
            const url = `/api/products${params.toString() ? '?' + params.toString() : ''}`;
            const { data } = await axios.get(url);
            return data.products;
        } catch (error) {
            return thunkAPI.rejectWithValue(error.response?.data || 'Failed to fetch products');
        }
    }
)

const productSlice = createSlice({
    name: 'product',
    initialState: {
        list: [],
        loading: false,
        error: null,
    },
    reducers: {
        setProduct: (state, action) => {
            state.list = action.payload
        },
        clearProduct: (state) => {
            state.list = []
        }
    },
    extraReducers: (builder)=>{
        builder
            .addCase(fetchProducts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchProducts.fulfilled, (state, action)=>{
                state.list = action.payload || [];
                state.loading = false;
                state.error = null;
            })
            .addCase(fetchProducts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                console.error('Failed to fetch products:', action.payload);
            })
    }
})

export const { setProduct, clearProduct } = productSlice.actions

export default productSlice.reducer