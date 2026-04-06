export default function Store1920CategoryDirectory() {
  return (
    <>
      <div className="qf-bottom">
        <div className="qf-container">

          <h2 className="qf-title">
            Top Categories on <span>Store1920.com</span>
          </h2>

          <div className="qf-section">
            <h3>Most Searched on Store1920</h3>
            <p>
              Smart Watches | Wireless Earbuds | Bluetooth Neckband | Gaming Mouse | LED Strip Light | Portable Fan |
              Power Bank | Hair Dryer | Beard Trimmer | Mobile Covers | Smart Fitness Bands | Action Cameras |
              Ring Lights | Tripods | Fast Chargers | USB Cables | Bluetooth Speakers | Smart TV Deals |
              Trending Gifts | Home Decor & DIY Tools
            </p>
          </div>

          <div className="qf-section">
            <h3>Mobiles & Accessories</h3>
            <p>
              Smartphones | iPhone | OnePlus | Samsung Galaxy | Realme | Vivo | Xiaomi Redmi | Poco | Motorola |
              Mobile Back Covers | Lens Protector | Fast Charging Cable | Type-C Cable | Wireless PowerBanks
            </p>
          </div>

          <div className="qf-section">
            <h3>Laptops & Electronics</h3>
            <p>
              Laptops | i5 / i7 / Ryzen | Student Laptops | Tablets | Mini PC | Mechanical Keyboard | Wireless Mouse |
              SSD / HDD | Printers | Scanners | Webcams | WiFi Router | HDMI Cables | Projectors | Smart Gadgets
            </p>
          </div>

          <div className="qf-section">
            <h3>Home, Kitchen & Lifestyle</h3>
            <p>
              Kitchen Essentials | Mixer Grinder | Air Fryer | Cookware Sets | Cleaning Supplies | Storage Organizers |
              Curtains | Bedsheets | Towels | Aroma Diffusers | Wall Shelf | Lighting | Kitchen Tools
            </p>
          </div>

          <div className="qf-section">
            <h3>Fashion & Clothing</h3>
            <p>
              Men's T-Shirts | Oversized Tees | Cargo Pants | Jeans | Women's Kurtis | Sarees | Abaya | Hoodies |
              Jackets | Kids Wear | Shoes | Sneakers | Handbags | Wallets | Watches | Sunglasses
            </p>
          </div>

          <div className="qf-section">
            <h3>Beauty & Personal Care</h3>
            <p>
              Face Wash | Sunscreen | Hair Serum | Perfume | Makeup Combo | Straightener | Curler | Nail Polish |
              Bath & Spa Essentials
            </p>
          </div>

          <div className="qf-section">
            <h3>Grocery & Daily Needs</h3>
            <p>
              Snacks | Beverages | Tea | Coffee | Honey | Dry Fruits | Detergent | Dish Wash | Floor Cleaner |
              Cereals | Noodles | Chocolates | Supplements
            </p>
          </div>

          <div className="qf-section">
            <h3>Fitness & Sports</h3>
            <p>
              Yoga Mats | Dumbbells | Resistance Bands | Skipping Rope | Running Shoes | Badminton | Football |
              Cricket | Massage Gun | Gym Gloves
            </p>
          </div>

          <div className="qf-footer-text">
            <h3>Store1920 – UAE’s Fast-Growing Shopping Platform</h3>
            <p>
              Shop the latest products across Electronics, Mobiles, Fashion, Beauty, Home Essentials, Fitness,
              Baby Items, Car Gadgets and more. Enjoy fast delivery, best pricing, secure checkout and daily deals.
            </p>
          </div>

        </div>
      </div>

      <style jsx>{`
        .qf-bottom {
          background: #f1f3f6; /* Flipkart-like light grey */
          padding: 30px 0;
          margin-top: 20px;
        }

        .qf-container {
          max-width: 1600px;
          margin: 0 auto;
          padding: 0 20px;
          font-family: Arial, sans-serif;
          color: #444;
          font-size: 13.5px;
        }

        .qf-title {
          font-size: 20px;
          font-weight: 700;
          color: #333;
          margin-bottom: 18px;
        }
        .qf-title span {
          color: #e60023;
        }

        .qf-section {
          margin-bottom: 18px;
        }

        .qf-section h3 {
          font-size: 14px;
          color: #222;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .qf-section p {
          line-height: 1.55;
        }

        .qf-footer-text {
          margin-top: 28px;
        }
        .qf-footer-text h3 {
          font-size: 14px;
          font-weight: 700;
          color: #222;
          margin-bottom: 5px;
        }

        /* Hide on mobile just like Flipkart */
        @media (max-width: 768px) {
          .qf-bottom {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
