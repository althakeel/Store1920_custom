<?php
/**
 * Rohith Order Confirm
 * Export / import WooCommerce orders for Store1920.
 *
 * HOW TO INSTALL IN functions.php
 * -------------------------------
 * Copy everything below the line "START PASTE" into your theme functions.php
 * OR upload this file and add one line to functions.php:
 *
 *   require_once get_stylesheet_directory() . '/rohith-order-confirm.php';
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('Rohith_Order_Confirm')) {

    class Rohith_Order_Confirm
    {
        const NAME = 'Rohith Order Confirm';
        const MENU_SLUG = 'rohith-order-confirm';
        const BATCH = 50;

        public static function boot()
        {
            add_action('admin_menu', [__CLASS__, 'menu']);
            add_action('admin_post_rohith_export_orders', [__CLASS__, 'export']);
            add_action('admin_post_rohith_import_orders', [__CLASS__, 'import']);
            add_action('admin_notices', [__CLASS__, 'notices']);
        }

        /* ---------- Admin page ---------- */

        public static function menu()
        {
            add_submenu_page(
                'woocommerce',
                self::NAME,
                self::NAME,
                'manage_woocommerce',
                self::MENU_SLUG,
                [__CLASS__, 'page']
            );
        }

        public static function notices()
        {
            if (!empty($_GET['rohith_error'])) {
                echo '<div class="notice notice-error"><p><strong>' . esc_html(self::NAME) . ':</strong> '
                    . esc_html(sanitize_text_field(wp_unslash($_GET['rohith_error']))) . '</p></div>';
            }
            if (!empty($_GET['rohith_ok'])) {
                $c = (int) ($_GET['created'] ?? 0);
                $u = (int) ($_GET['updated'] ?? 0);
                $f = (int) ($_GET['failed'] ?? 0);
                echo '<div class="notice notice-success"><p><strong>' . esc_html(self::NAME) . ':</strong> '
                    . 'Import done. Created ' . $c . ', Updated ' . $u . ', Failed ' . $f . '.</p></div>';
            }
        }

        public static function page()
        {
            if (!current_user_can('manage_woocommerce')) {
                wp_die('No permission.');
            }

            $all = wp_nonce_url(admin_url('admin-post.php?action=rohith_export_orders'), 'rohith_export');
            $recent = wp_nonce_url(admin_url('admin-post.php?action=rohith_export_orders&days=90'), 'rohith_export');
            $stats = self::order_stats();
            $status_rows = self::status_breakdown();
            ?>
            <div class="wrap">
                <h1><?php echo esc_html(self::NAME); ?></h1>
                <p>Export WooCommerce orders with <strong>customer, products, total, payment, status, delivered</strong> for Store1920.</p>

                <div class="card" style="max-width:720px;padding:20px;margin:16px 0;">
                    <h2 style="margin-top:0;">Export orders</h2>
                    <p><b>Exportable orders:</b> <?php echo esc_html(number_format_i18n($stats['exportable'])); ?></p>
                    <?php if ($stats['trash'] > 0) : ?>
                        <p style="color:#646970;"><b>Trash (not exported):</b> <?php echo esc_html(number_format_i18n($stats['trash'])); ?></p>
                    <?php endif; ?>
                    <p style="color:#646970;">WordPress “All” may show <?php echo esc_html(number_format_i18n($stats['wp_all'])); ?> including trash. Export uses every active status (not trash). Re-import on Store1920 replaces orders matched by <code>wc-{order id}</code>.</p>
                    <p style="color:#b32d2e;"><b>Important:</b> Your CSV should have <b><?php echo esc_html(number_format_i18n($stats['exportable'])); ?></b> data rows. If you only see ~7,605 rows, update this plugin and export again.</p>
                    <table class="widefat striped" style="margin-top:12px;">
                        <thead>
                            <tr>
                                <th>WooCommerce status</th>
                                <th style="text-align:right;">Count</th>
                                <th>→ Store1920 status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($status_rows as $row) : ?>
                                <tr>
                                    <td><?php echo esc_html($row['label']); ?></td>
                                    <td style="text-align:right;"><?php echo esc_html(number_format_i18n($row['count'])); ?></td>
                                    <td><code><?php echo esc_html($row['store_status']); ?></code></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                        <tfoot>
                            <tr>
                                <th>Exportable total</th>
                                <th style="text-align:right;"><?php echo esc_html(number_format_i18n($stats['exportable'])); ?></th>
                                <th></th>
                            </tr>
                        </tfoot>
                    </table>
                    <p>CSV columns: order number, customer name/email/phone, address, products, total, payment method, paid status, delivered yes/no, tracking AWB.</p>
                    <p>
                        <a class="button button-primary button-hero" href="<?php echo esc_url($all); ?>">Export all orders</a>
                        <a class="button" href="<?php echo esc_url($recent); ?>">Export last 90 days</a>
                    </p>
                </div>

                <div class="card" style="max-width:720px;padding:20px;">
                    <h2 style="margin-top:0;">Import CSV into WooCommerce</h2>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" enctype="multipart/form-data">
                        <?php wp_nonce_field('rohith_import'); ?>
                        <input type="hidden" name="action" value="rohith_import_orders" />
                        <input type="file" name="rohith_csv" accept=".csv" required />
                        <p><button type="submit" class="button">Import CSV</button></p>
                    </form>
                </div>

                <h2>Then on Store1920</h2>
                <ol>
                    <li>Go to <code>/store/orders</code></li>
                    <li>Click <b>Import Orders CSV</b></li>
                    <li>Upload the exported file</li>
                </ol>
            </div>
            <?php
        }

        /* ---------- Export ---------- */

        public static function export()
        {
            if (!current_user_can('manage_woocommerce')) {
                wp_die('No permission.');
            }
            check_admin_referer('rohith_export');

            if (!function_exists('wc_get_orders')) {
                self::fail('WooCommerce is not active.');
            }

            @set_time_limit(0);
            while (ob_get_level()) {
                ob_end_clean();
            }

            $days = max(0, (int) ($_GET['days'] ?? 0));
            $file = $days
                ? 'rohith-orders-90days-' . gmdate('Y-m-d') . '.csv'
                : 'rohith-orders-' . gmdate('Y-m-d') . '.csv';

            header('Content-Type: text/csv; charset=UTF-8');
            header('Content-Disposition: attachment; filename="' . $file . '"');

            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF) . chr(0xBB) . chr(0xBF));
            fputcsv($out, self::headers());

            $exported = self::stream_export_rows($out, $days);

            // Trailing comment row helps verify export completeness in Excel / LibreOffice.
            fputcsv($out, ['# EXPORT_META', 'exported_rows', (string) $exported, 'expected_rows', (string) self::order_stats()['exportable']]);

            fclose($out);
            exit;
        }

        /**
         * Export per WooCommerce status to avoid HPOS pagination bugs when
         * querying many statuses at once (wc_get_orders can under-report max_num_pages).
         */
        private static function stream_export_rows($out, $days = 0)
        {
            $exported = 0;
            $seen = [];

            foreach (self::export_status_list() as $status) {
                $page = 1;
                $max_pages = 1;

                do {
                    $args = [
                        'limit' => self::BATCH,
                        'paginate' => true,
                        'page' => $page,
                        'orderby' => 'date',
                        'order' => 'DESC',
                        'status' => $status,
                        'type' => 'shop_order',
                        'return' => 'objects',
                    ];
                    if ($days > 0) {
                        $args['date_created'] = '>' . (time() - $days * DAY_IN_SECONDS);
                    }

                    $batch = wc_get_orders($args);
                    if (!is_object($batch) || empty($batch->orders)) {
                        break;
                    }

                    $max_pages = max(1, (int) ($batch->max_num_pages ?? 1));
                    foreach ($batch->orders as $order) {
                        if (!$order instanceof WC_Order) {
                            continue;
                        }
                        $order_id = (int) $order->get_id();
                        if (isset($seen[$order_id])) {
                            continue;
                        }
                        $seen[$order_id] = true;
                        fputcsv($out, self::row($order));
                        $exported++;
                    }
                    $page++;
                } while ($page <= $max_pages);
            }

            return $exported;
        }

        private static function headers()
        {
            return [
                'legacySourceId', 'woocommerceOrderId', 'shortOrderNumber', 'orderNumber',
                'customerName', 'guestName', 'customerEmail', 'guestEmail',
                'customerPhone', 'guestPhone',
                'total', 'orderTotal', 'subtotal', 'shippingFee', 'discountTotal', 'taxTotal', 'currency',
                'status', 'statusLabel', 'isDelivered', 'deliveryStatus', 'woocommerceStatus', 'woocommerceStatusLabel',
                'paymentMethod', 'paymentMethodTitle', 'paymentStatus', 'isPaid', 'isGuest',
                'productName', 'productNames', 'productsSummary', 'quantity', 'itemCount',
                'orderItems', 'lineItems',
                'trackingId', 'trackingUrl', 'courier', 'notes',
                'shippingName', 'shippingPhone',
                'shippingAddress1', 'shippingAddress2', 'shippingCity', 'shippingState',
                'shippingCountry', 'shippingPostcode',
                'createdAt', 'updatedAt', 'dateCompleted', 'datePaid',
            ];
        }

        private static function row(WC_Order $order)
        {
            $data = self::build_row($order);
            $line = [];
            foreach (self::headers() as $h) {
                $line[] = $data[$h] ?? '';
            }
            return $line;
        }

        private static function build_row(WC_Order $order)
        {
            $bill = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
            $ship = trim($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name());
            $name = $ship ?: $bill;
            if ($name === '') {
                $name = trim(strip_tags($order->get_formatted_billing_full_name()));
            }

            $email = $order->get_billing_email();
            $phone = $order->get_billing_phone() ?: $order->get_shipping_phone();
            $addr = self::address($order, $name, $phone);
            $items = self::items($order);
            $track = self::tracking($order);

            $wc_status = str_replace('wc-', '', (string) $order->get_status());
            $wc_labels = function_exists('wc_get_order_statuses') ? wc_get_order_statuses() : [];
            $wc_label = $wc_labels['wc-' . $wc_status] ?? $wc_status;

            $status = self::to_store_status($wc_status, $wc_label);
            $delivered = ($status === 'DELIVERED');

            $pay_code = self::pay_code($order->get_payment_method());
            $pay_title = $order->get_payment_method_title() ?: $pay_code;
            $payment = self::resolve_payment($order, $status, $wc_status, $pay_code);

            $sub = (float) $order->get_subtotal();
            $ship_fee = (float) $order->get_shipping_total();
            $disc = abs((float) $order->get_discount_total());
            $tax = (float) $order->get_total_tax();
            $total = (float) $order->get_total();

            if ($total <= 0 && $items) {
                foreach ($items as $i) {
                    $total += $i['price'] * $i['quantity'];
                }
                $total += $ship_fee - $disc + $tax;
            }

            $names = array_column($items, 'name');
            $summary = [];
            foreach ($items as $i) {
                $summary[] = $i['name'] . ' x' . $i['quantity'] . ' @ ' . $i['price'];
            }
            $pipes = [];
            foreach ($items as $i) {
                $pipes[] = $i['name'] . '::' . $i['quantity'] . '::' . $i['price'] . '::' . $i['sku'];
            }

            $qty = $items ? (int) $items[0]['quantity'] : 0;
            $count = 0;
            foreach ($items as $i) {
                $count += (int) $i['quantity'];
            }

            $num = $order->get_order_number();
            $cur = strtoupper($order->get_currency() ?: 'AED');

            return [
                'legacySourceId' => 'wc-' . $order->get_id(),
                'woocommerceOrderId' => (string) $order->get_id(),
                'shortOrderNumber' => $num,
                'orderNumber' => $num,
                'customerName' => $name,
                'guestName' => $name,
                'customerEmail' => $email,
                'guestEmail' => $email,
                'customerPhone' => $phone,
                'guestPhone' => $phone,
                'total' => wc_format_decimal($total, 2),
                'orderTotal' => wc_format_decimal($total, 2),
                'subtotal' => wc_format_decimal($sub, 2),
                'shippingFee' => wc_format_decimal($ship_fee, 2),
                'discountTotal' => wc_format_decimal($disc, 2),
                'taxTotal' => wc_format_decimal($tax, 2),
                'currency' => $cur,
                'status' => $status,
                'statusLabel' => self::status_label($status),
                'isDelivered' => $delivered ? 'yes' : 'no',
                'deliveryStatus' => self::delivery_status($status, $track['id']),
                'woocommerceStatus' => $wc_status,
                'woocommerceStatusLabel' => $wc_label,
                'paymentMethod' => $pay_code,
                'paymentMethodTitle' => $pay_title,
                'paymentStatus' => $payment['paymentStatus'],
                'isPaid' => $payment['isPaid'] ? 'true' : 'false',
                'isGuest' => $order->get_user_id() ? 'false' : 'true',
                'productName' => $names ? $names[0] : '',
                'productNames' => implode(' | ', $names),
                'productsSummary' => implode(' | ', $summary),
                'quantity' => $qty,
                'itemCount' => $count,
                'orderItems' => wp_json_encode($items),
                'lineItems' => implode('|', $pipes),
                'trackingId' => $track['id'],
                'trackingUrl' => $track['url'],
                'courier' => $track['courier'],
                'notes' => $order->get_customer_note(),
                'shippingName' => $addr['name'],
                'shippingPhone' => $addr['phone'],
                'shippingAddress1' => $addr['street'],
                'shippingAddress2' => $addr['line2'],
                'shippingCity' => $addr['city'],
                'shippingState' => $addr['state'],
                'shippingCountry' => $addr['country'],
                'shippingPostcode' => $addr['postcode'],
                'createdAt' => self::iso($order->get_date_created()),
                'updatedAt' => self::iso($order->get_date_modified()),
                'dateCompleted' => self::iso($order->get_date_completed()),
                'datePaid' => self::iso($order->get_date_paid()),
            ];
        }

        private static function address(WC_Order $order, $name, $phone)
        {
            $cc = $order->get_shipping_country() ?: $order->get_billing_country();
            $countries = WC()->countries->get_countries();
            $country = $countries[$cc] ?? $cc;
            $sc = $order->get_shipping_state() ?: $order->get_billing_state();
            $state = $sc;
            $states = WC()->countries->get_states($cc);
            if (is_array($states) && isset($states[$sc])) {
                $state = $states[$sc];
            }

            $sn = trim($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name());
            return [
                'name' => $sn ?: $name,
                'phone' => $order->get_shipping_phone() ?: $phone,
                'street' => $order->get_shipping_address_1() ?: $order->get_billing_address_1(),
                'line2' => $order->get_shipping_address_2() ?: $order->get_billing_address_2(),
                'city' => $order->get_shipping_city() ?: $order->get_billing_city(),
                'state' => $state,
                'country' => $country,
                'postcode' => $order->get_shipping_postcode() ?: $order->get_billing_postcode(),
            ];
        }

        private static function items(WC_Order $order)
        {
            $list = [];
            foreach ($order->get_items('line_item') as $item) {
                if (!$item instanceof WC_Order_Item_Product) {
                    continue;
                }
                $q = max(1, (int) $item->get_quantity());
                $p = $q > 0 ? round((float) $item->get_total() / $q, 2) : 0;
                $prod = $item->get_product();
                $product_id = $prod ? (int) $prod->get_id() : 0;
                $list[] = [
                    'name' => $item->get_name(),
                    'quantity' => $q,
                    'price' => $p,
                    'sku' => $prod ? (string) $prod->get_sku() : '',
                    'woocommerceProductId' => $product_id ? (string) $product_id : '',
                    'legacySourceId' => $product_id ? 'woo:' . $product_id : '',
                ];
            }
            return $list;
        }

        private static function tracking(WC_Order $order)
        {
            $id = $url = $courier = '';
            foreach (['_tracking_number', 'tracking_number', '_awb_number', '_wc_shipment_tracking_items'] as $key) {
                $v = $order->get_meta($key);
                if (!$v) {
                    continue;
                }
                if (is_array($v) && isset($v[0]['tracking_number'])) {
                    $id = (string) $v[0]['tracking_number'];
                    $url = (string) ($v[0]['tracking_link'] ?? '');
                    $courier = (string) ($v[0]['tracking_provider'] ?? '');
                } else {
                    $id = (string) $v;
                }
                if ($id) {
                    break;
                }
            }
            if (!$courier) {
                $courier = (string) $order->get_meta('_shipping_provider');
            }
            return ['id' => $id, 'url' => $url, 'courier' => $courier];
        }

        private static function normalize_wc_status($raw, $label = '')
        {
            $slug = strtolower(str_replace('wc-', '', (string) $raw));
            $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
            $slug = trim($slug, '-');

            $text = strtolower(trim((string) $label));
            $text = preg_replace('/[^a-z0-9]+/', '-', $text);
            $text = trim($text, '-');

            return $slug ?: $text;
        }

        private static function to_store_status($raw, $label = '')
        {
            $s = self::normalize_wc_status($raw, $label);

            $exact = [
                'pending' => 'ORDER_PLACED',
                'confirmed' => 'ORDER_PLACED',
                'processing' => 'PROCESSING',
                'on-hold' => 'ORDER_PLACED',
                'completed' => 'DELIVERED',
                'closed' => 'DELIVERED',
                'cancelled' => 'CANCELLED',
                'refunded' => 'RETURNED',
                'failed' => 'PAYMENT_FAILED',
                'shipped' => 'SHIPPED',
                'paid' => 'DELIVERED',
                'returned' => 'RETURNED',
                'return-request' => 'RETURN_REQUESTED',
                'return-requested' => 'RETURN_REQUESTED',
                'return-approved' => 'RETURN_APPROVED',
                'return-rejected' => 'PROCESSING',
                'return-reject' => 'PROCESSING',
                'delivery-failed' => 'CANCELLED',
                'cash-on-delivery' => 'ORDER_PLACED',
                'cod' => 'ORDER_PLACED',
                'out-for-delivery' => 'OUT_FOR_DELIVERY',
            ];

            if (isset($exact[$s])) {
                return $exact[$s];
            }

            if (strpos($s, 'return') !== false) {
                if (strpos($s, 'reject') !== false) {
                    return 'PROCESSING';
                }
                if (strpos($s, 'approv') !== false) {
                    return 'RETURN_APPROVED';
                }
                if (strpos($s, 'request') !== false || strpos($s, 'initiat') !== false) {
                    return 'RETURN_REQUESTED';
                }
                return 'RETURNED';
            }
            if (strpos($s, 'deliver') !== false && strpos($s, 'fail') !== false) {
                return 'CANCELLED';
            }
            if (strpos($s, 'ship') !== false) {
                return 'SHIPPED';
            }
            if (strpos($s, 'cancel') !== false) {
                return 'CANCELLED';
            }
            if (strpos($s, 'refund') !== false) {
                return 'RETURNED';
            }
            if (strpos($s, 'fail') !== false) {
                return 'PAYMENT_FAILED';
            }
            if (strpos($s, 'complet') !== false || strpos($s, 'closed') !== false || $s === 'paid') {
                return 'DELIVERED';
            }
            if (strpos($s, 'process') !== false || strpos($s, 'confirm') !== false) {
                return 'PROCESSING';
            }

            return 'ORDER_PLACED';
        }

        private static function delivery_status($store_status, $tracking_id = '')
        {
            if ($store_status === 'DELIVERED') {
                return 'Delivered';
            }
            if (in_array($store_status, ['RETURNED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_INITIATED'], true)) {
                return 'Returned';
            }
            if (in_array($store_status, ['CANCELLED', 'PAYMENT_FAILED'], true)) {
                return 'Cancelled';
            }
            if ($tracking_id || in_array($store_status, ['SHIPPED', 'OUT_FOR_DELIVERY', 'PICKED_UP'], true)) {
                return 'Shipped';
            }
            return 'Not delivered';
        }

        private static function resolve_payment(WC_Order $order, $store_status, $wc_status, $pay_code)
        {
            $paid = $order->is_paid() || (bool) $order->get_date_paid();
            $wc_slug = self::normalize_wc_status($wc_status);

            if (in_array($wc_slug, ['paid', 'completed'], true)) {
                $paid = true;
            }

            if ($pay_code === 'COD') {
                if ($store_status === 'DELIVERED') {
                    $paid = true;
                }
                if (in_array($store_status, ['RETURNED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'CANCELLED', 'PAYMENT_FAILED'], true)) {
                    $paid = false;
                }
            }

            if (in_array($store_status, ['RETURNED', 'CANCELLED'], true) && $order->get_date_paid()) {
                $paid = true;
            }

            return [
                'isPaid' => $paid,
                'paymentStatus' => $paid ? 'PAID' : 'Pending',
            ];
        }

        private static function status_label($s)
        {
            $map = [
                'ORDER_PLACED' => 'Order placed',
                'PROCESSING' => 'Processing',
                'SHIPPED' => 'Shipped',
                'OUT_FOR_DELIVERY' => 'Out for delivery',
                'DELIVERED' => 'Delivered',
                'CANCELLED' => 'Cancelled',
                'RETURNED' => 'Returned',
                'RETURN_REQUESTED' => 'Return requested',
                'RETURN_APPROVED' => 'Return approved',
                'RETURN_INITIATED' => 'Return initiated',
                'PAYMENT_FAILED' => 'Payment failed',
            ];
            return $map[$s] ?? $s;
        }

        private static function pay_code($m)
        {
            $m = strtolower((string) $m);
            if (strpos($m, 'wallet') !== false || strpos($m, 'store-credit') !== false) return 'WALLET';
            if (strpos($m, 'cod') !== false || strpos($m, 'cash') !== false) return 'COD';
            if (strpos($m, 'tabby') !== false) return 'TABBY';
            if (strpos($m, 'tamara') !== false) return 'TAMARA';
            if (strpos($m, 'stripe') !== false) return 'STRIPE';
            if (strpos($m, 'razorpay') !== false) return 'RAZORPAY';
            if (
                strpos($m, 'card') !== false
                || strpos($m, 'paypal') !== false
                || strpos($m, 'prepaid') !== false
                || strpos($m, 'ccavenue') !== false
                || strpos($m, 'tap') !== false
            ) {
                return 'CARD';
            }
            return strtoupper($m ?: 'COD');
        }

        private static function iso($d)
        {
            return ($d && method_exists($d, 'date')) ? $d->date('c') : '';
        }

        private static function export_status_list()
        {
            if (!function_exists('wc_get_order_statuses')) {
                return ['any'];
            }

            $statuses = [];
            foreach (array_keys(wc_get_order_statuses()) as $status) {
                $slug = str_replace('wc-', '', $status);
                if ($slug !== '') {
                    $statuses[] = $slug;
                }
            }

            return $statuses ?: ['any'];
        }

        /** @deprecated Use export_status_list() */
        private static function export_statuses()
        {
            $list = self::export_status_list();
            return count($list) === 1 ? $list[0] : $list;
        }

        private static function status_breakdown()
        {
            if (!function_exists('wc_get_order_statuses') || !function_exists('wc_orders_count')) {
                return [];
            }

            $rows = [];
            foreach (wc_get_order_statuses() as $status_key => $label) {
                $slug = str_replace('wc-', '', $status_key);
                $rows[] = [
                    'label' => $label,
                    'count' => (int) wc_orders_count($slug),
                    'store_status' => self::to_store_status($slug, $label),
                ];
            }

            usort($rows, static function ($a, $b) {
                return $b['count'] <=> $a['count'];
            });

            return $rows;
        }

        private static function order_stats()
        {
            if (!function_exists('wc_orders_count')) {
                return ['exportable' => 0, 'trash' => 0, 'wp_all' => 0];
            }

            $exportable = 0;
            foreach (array_keys(wc_get_order_statuses()) as $status) {
                $slug = str_replace('wc-', '', $status);
                $exportable += (int) wc_orders_count($slug);
            }

            $trash = (int) wc_orders_count('trash');

            return [
                'exportable' => $exportable,
                'trash' => $trash,
                'wp_all' => $exportable + $trash,
            ];
        }

        /* ---------- Import ---------- */

        public static function import()
        {
            if (!current_user_can('manage_woocommerce')) wp_die('No permission.');
            check_admin_referer('rohith_import');

            $path = $_FILES['rohith_csv']['tmp_name'] ?? '';
            if (!$path) self::fail('Choose a CSV file.');

            $rows = self::read_csv($path);
            if (!$rows) self::fail('CSV is empty.');

            $created = $updated = $failed = 0;
            foreach ($rows as $row) {
                try {
                    $r = self::import_row($row);
                    if ($r === 'created') $created++;
                    elseif ($r === 'updated') $updated++;
                } catch (Exception $e) {
                    $failed++;
                }
            }

            wp_safe_redirect(add_query_arg([
                'page' => self::MENU_SLUG, 'rohith_ok' => 1,
                'created' => $created, 'updated' => $updated, 'failed' => $failed,
            ], admin_url('admin.php')));
            exit;
        }

        private static function read_csv($path)
        {
            $rows = [];
            $h = fopen($path, 'r');
            if (!$h) return $rows;
            $headers = null;
            while (($line = fgetcsv($h)) !== false) {
                if ($headers === null) {
                    $headers = array_map('trim', $line);
                    continue;
                }
                $row = [];
                foreach ($headers as $i => $key) {
                    $row[$key] = $line[$i] ?? '';
                }
                if (implode('', $row) !== '') $rows[] = $row;
            }
            fclose($h);
            return $rows;
        }

        private static function import_row(array $row)
        {
            $legacy = trim($row['legacySourceId'] ?? '');
            $oid = 0;
            if (preg_match('/^wc-(\d+)$/i', $legacy, $m)) $oid = (int) $m[1];

            $order = $oid ? wc_get_order($oid) : null;
            $new = !$order;
            if ($new) $order = wc_create_order();

            $name = trim($row['customerName'] ?? $row['shippingName'] ?? '');
            $parts = preg_split('/\s+/', $name, 2);
            $fn = $parts[0] ?? '';
            $ln = $parts[1] ?? '';

            $order->set_billing_first_name($fn);
            $order->set_billing_last_name($ln);
            $order->set_billing_email($row['customerEmail'] ?? '');
            $order->set_billing_phone($row['customerPhone'] ?? '');
            $order->set_shipping_first_name($fn);
            $order->set_shipping_last_name($ln);
            $order->set_shipping_phone($row['customerPhone'] ?? '');

            foreach (['address1' => 'shippingAddress1', 'address2' => 'shippingAddress2', 'city' => 'shippingCity', 'state' => 'shippingState', 'postcode' => 'shippingPostcode'] as $f => $col) {
                $setter_b = 'set_billing_' . $f;
                $setter_s = 'set_shipping_' . $f;
                if (method_exists($order, $setter_b)) $order->$setter_b($row[$col] ?? '');
                if (method_exists($order, $setter_s)) $order->$setter_s($row[$col] ?? '');
            }
            $cc = self::country_code($row['shippingCountry'] ?? 'AE');
            $order->set_billing_country($cc);
            $order->set_shipping_country($cc);

            if ($new) {
                foreach (self::parse_items($row['orderItems'] ?? $row['lineItems'] ?? '') as $item) {
                    $pid = $item['sku'] ? wc_get_product_id_by_sku($item['sku']) : 0;
                    $order->add_product($pid ? wc_get_product($pid) : null, $item['quantity'], [
                        'name' => $item['name'],
                        'subtotal' => $item['price'] * $item['quantity'],
                        'total' => $item['price'] * $item['quantity'],
                    ]);
                }
            }

            $total = (float) ($row['total'] ?? 0);
            if ($total > 0) $order->set_total($total);
            else $order->calculate_totals();

            $order->set_status(self::to_wc_status($row['status'] ?? 'ORDER_PLACED'));
            $order->save();
            return $new ? 'created' : 'updated';
        }

        private static function parse_items($raw)
        {
            $raw = trim($raw);
            if (!$raw) return [];
            $json = json_decode($raw, true);
            if (is_array($json)) {
                $out = [];
                foreach ($json as $i) {
                    if (empty($i['name'])) continue;
                    $out[] = ['name' => $i['name'], 'quantity' => max(1, (int) ($i['quantity'] ?? 1)), 'price' => (float) ($i['price'] ?? 0), 'sku' => $i['sku'] ?? ''];
                }
                return $out;
            }
            $out = [];
            foreach (explode('|', $raw) as $chunk) {
                $p = array_map('trim', explode('::', $chunk));
                if (empty($p[0])) continue;
                $out[] = ['name' => $p[0], 'quantity' => max(1, (int) ($p[1] ?? 1)), 'price' => (float) ($p[2] ?? 0), 'sku' => $p[3] ?? ''];
            }
            return $out;
        }

        private static function to_wc_status($s)
        {
            $map = [
                'ORDER_PLACED' => 'processing',
                'PROCESSING' => 'processing',
                'SHIPPED' => 'shipped',
                'OUT_FOR_DELIVERY' => 'shipped',
                'DELIVERED' => 'completed',
                'CANCELLED' => 'cancelled',
                'RETURNED' => 'returned',
                'RETURN_REQUESTED' => 'return-request',
                'RETURN_APPROVED' => 'return-approved',
                'RETURN_INITIATED' => 'return-request',
                'PAYMENT_FAILED' => 'failed',
            ];
            return $map[strtoupper((string) $s)] ?? 'processing';
        }

        private static function country_code($name)
        {
            $name = trim($name);
            if (strlen($name) === 2) return strtoupper($name);
            foreach (WC()->countries->get_countries() as $code => $label) {
                if (strcasecmp($label, $name) === 0) return $code;
            }
            return 'AE';
        }

        private static function fail($msg)
        {
            wp_safe_redirect(add_query_arg('rohith_error', rawurlencode($msg), admin_url('admin.php?page=' . self::MENU_SLUG)));
            exit;
        }
    }

    add_action('init', function () {
        if (class_exists('WooCommerce')) {
            Rohith_Order_Confirm::boot();
        }
    });
}

/*
 * ============================================================
 * START PASTE — copy from here into functions.php
 * ============================================================
 *
 * Option A — paste this whole file content into functions.php
 *
 * Option B — upload rohith-order-confirm.php to your theme folder, then add:
 *
 *   require_once get_stylesheet_directory() . '/rohith-order-confirm.php';
 *
 * Then in WordPress admin go to:
 *   WooCommerce → Rohith Order Confirm → Export all orders
 */
