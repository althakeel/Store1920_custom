import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Rating from "@/models/Rating";
import AbandonedCart from "@/models/AbandonedCart";
import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/firebase-admin";

// Next.js API route handler for GET
export async function GET(request) {
   try {
      // Firebase Auth: Extract token from Authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
         decodedToken = await getAuth().verifyIdToken(idToken);
      } catch (e) {
         return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      const userId = decodedToken.uid;
      const storeId = await authSeller(userId);
      if (!storeId) {
         return NextResponse.json({ error: 'Forbidden: Seller not approved or no store found.' }, { status: 403 });
      }

      await dbConnect();
      // Get all orders for seller
      const orders = await Order.find({ storeId }).lean();

      // Get all products with ratings for seller
      const products = await Product.find({ storeId }).lean();

      const ratings = await Rating.find({
         productId: { $in: products.map(product => product._id.toString()) }
      }).lean();

      // Get unique customers who have ordered from this store
      const uniqueCustomerIds = [...new Set(orders.map(order => order.userId))];
      const totalCustomers = uniqueCustomerIds.length;

      // Get abandoned carts for this store
      const abandonedCarts = await AbandonedCart.countDocuments({ storeId });

      const dashboardData = {
         ratings,
         totalOrders: orders.length,
         totalEarnings: Math.round(orders.reduce((acc, order) => acc + (order.total || 0), 0)),
         totalProducts: products.length,
         totalCustomers,
         abandonedCarts
      };

      return NextResponse.json({ dashboardData });
   } catch (error) {
      console.error(error);
      return NextResponse.json({ error: error.code || error.message }, { status: 400 });
   }
}