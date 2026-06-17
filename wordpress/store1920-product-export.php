<?php
/**
 * Plugin Name: Store1920 Product Export
 * Plugin URI:  https://store1920.com
 * Description: Export all WooCommerce products (5000+) to CSV with images for Store1920 bulk import.
 * Version:     1.1.2
 * Author:      Store1920
 * Requires Plugins: woocommerce
 *
 * INSTALL (choose one):
 * 1) Upload this file to wp-content/plugins/store1920-product-export/store1920-product-export.php and activate.
 * 2) OR paste everything BELOW the "PASTE INTO functions.php" line into your theme functions.php.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('Store1920_Product_Export')) {

    class Store1920_Product_Export
    {
        const MENU_SLUG = 'store1920-product-export';
        const BATCH_SIZE = 100;
        const MAX_ATTRIBUTES = 5;
        const TEST_EXPORT_LIMIT = 50;

        public static function boot()
        {
            add_action('admin_menu', [__CLASS__, 'register_menu']);
            add_action('admin_post_store1920_export_products', [__CLASS__, 'handle_export']);
            add_action('admin_notices', [__CLASS__, 'admin_notices']);
        }

        public static function register_menu()
        {
            add_submenu_page(
                'woocommerce',
                'Store1920 Export',
                'Store1920 Export',
                'manage_woocommerce',
                self::MENU_SLUG,
                [__CLASS__, 'render_page']
            );
        }

        public static function admin_notices()
        {
            if (!isset($_GET['store1920_export_error'])) {
                return;
            }

            $message = sanitize_text_field(wp_unslash($_GET['store1920_export_error']));
            if (!$message) {
                return;
            }

            printf(
                '<div class="notice notice-error is-dismissible"><p><strong>Store1920 Export:</strong> %s</p></div>',
                esc_html($message)
            );
        }

        public static function render_page()
        {
            if (!current_user_can('manage_woocommerce')) {
                wp_die(esc_html__('You do not have permission to export products.', 'store1920'));
            }

            $export_all_url = wp_nonce_url(
                admin_url('admin-post.php?action=store1920_export_products'),
                'store1920_export_products'
            );
            $export_test_url = wp_nonce_url(
                admin_url('admin-post.php?action=store1920_export_products&limit=' . self::TEST_EXPORT_LIMIT),
                'store1920_export_products'
            );

            $product_count = wp_count_posts('product');
            $total = isset($product_count->publish) ? (int) $product_count->publish : 0;
            $total += isset($product_count->draft) ? (int) $product_count->draft : 0;
            $total += isset($product_count->private) ? (int) $product_count->private : 0;
            ?>
            <div class="wrap">
                <h1>Store1920 Product Export</h1>
                <p>Export all WooCommerce products to CSV for <strong>Store → Bulk Import</strong>.</p>
                    <p>Includes: name, descriptions, prices, categories, SKU, stock, brands, <strong>variants (size/color/etc.)</strong>, attributes, and <strong>full image URLs</strong>.</p>

                <div class="card" style="max-width:720px;padding:16px 20px;">
                    <p><strong>Products found:</strong> <?php echo esc_html(number_format_i18n($total)); ?></p>
                    <p><strong>Format:</strong> WooCommerce-compatible CSV (works with 5000+ products).</p>
                    <p style="color:#646970;">Tip: Start with the <strong>50-product test export</strong> to verify variants and images on Store1920 before exporting all <?php echo esc_html(number_format_i18n($total)); ?> products.</p>
                    <p style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
                        <a class="button button-secondary button-hero" href="<?php echo esc_url($export_test_url); ?>">
                            Test Export (<?php echo esc_html((string) self::TEST_EXPORT_LIMIT); ?> products)
                        </a>
                        <a class="button button-primary button-hero" href="<?php echo esc_url($export_all_url); ?>">
                            Export All Products
                        </a>
                    </p>
                    <p style="color:#646970;margin-top:12px;">For the full export, run when traffic is low. Do not close the browser until download starts.</p>
                </div>

                <h2 style="margin-top:24px;">Import on Store1920</h2>
                <ol>
                    <li>Go to <code>/store/bulk-import</code> in your Store1920 dashboard.</li>
                    <li>Upload this CSV (or convert to .xlsx if you prefer).</li>
                    <li>Variable products export as <strong>1 parent row + 1 row per variation</strong>.</li>
                    <li>Each variation exports its <strong>own image</strong> (if set in WooCommerce) for color/size switching on Store1920.</li>
                    <li>On Store1920 import, variations become size/color options on the same product.</li>
                </ol>
            </div>
            <?php
        }

        public static function handle_export()
        {
            if (!current_user_can('manage_woocommerce')) {
                wp_die(esc_html__('Permission denied.', 'store1920'));
            }

            check_admin_referer('store1920_export_products');

            if (!function_exists('wc_get_products')) {
                self::redirect_with_error('WooCommerce is not active.');
            }

            @set_time_limit(0);
            @ini_set('memory_limit', '768M');

            while (ob_get_level() > 0) {
                ob_end_clean();
            }

            $limit = isset($_GET['limit']) ? max(0, (int) $_GET['limit']) : 0;
            if ($limit > 0) {
                $limit = min($limit, 500);
            }

            $filename = $limit > 0
                ? 'store1920-products-test-' . $limit . '-' . gmdate('Y-m-d-His') . '.csv'
                : 'store1920-products-' . gmdate('Y-m-d-His') . '.csv';

            nocache_headers();
            header('Content-Type: text/csv; charset=UTF-8');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Pragma: no-cache');
            header('Expires: 0');

            $output = fopen('php://output', 'w');
            if (!$output) {
                self::redirect_with_error('Unable to open output stream.');
            }

            // UTF-8 BOM helps Excel open Arabic/special characters correctly.
            fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));
            fputcsv($output, self::get_headers());

            $page = 1;
            $exported_parents = 0;

            do {
                $product_ids = wc_get_products([
                    'status' => ['publish', 'draft', 'private'],
                    'type' => ['simple', 'variable', 'grouped', 'external'],
                    'parent' => 0,
                    'limit' => self::BATCH_SIZE,
                    'page' => $page,
                    'paginate' => false,
                    'return' => 'ids',
                    'orderby' => 'ID',
                    'order' => 'ASC',
                ]);

                if (empty($product_ids)) {
                    break;
                }

                foreach ($product_ids as $product_id) {
                    if ($limit > 0 && $exported_parents >= $limit) {
                        break 2;
                    }

                    $product = wc_get_product($product_id);
                    if (!$product) {
                        continue;
                    }

                    self::write_product_rows($output, $product);
                    $exported_parents++;
                }

                $page++;
                fflush($output);
            } while (
                count($product_ids) === self::BATCH_SIZE
                && ($limit <= 0 || $exported_parents < $limit)
            );

            fclose($output);
            exit;
        }

        private static function redirect_with_error($message)
        {
            wp_safe_redirect(add_query_arg(
                'store1920_export_error',
                rawurlencode($message),
                admin_url('admin.php?page=' . self::MENU_SLUG)
            ));
            exit;
        }

        private static function get_headers()
        {
            $headers = [
                'ID',
                'Type',
                'SKU',
                'Name',
                'Slug',
                'Published',
                'Is featured?',
                'Visibility in catalog',
                'Short description',
                'Description',
                'Sale price',
                'Regular price',
                'Categories',
                'Tags',
                'Brands',
                'In stock?',
                'Stock',
                'Meta: _total_stock_quantity',
                'Images',
                'Parent',
                'Weight (kg)',
                'Length (cm)',
                'Width (cm)',
                'Height (cm)',
            ];

            for ($index = 1; $index <= self::MAX_ATTRIBUTES; $index++) {
                $headers[] = "Attribute {$index} name";
                $headers[] = "Attribute {$index} value(s)";
                $headers[] = "Attribute {$index} visible";
                $headers[] = "Attribute {$index} global";
            }

            return $headers;
        }

        private static function write_product_rows($output, WC_Product $product)
        {
            if ($product->is_type('variable')) {
                fputcsv($output, self::map_product_row($product));
                foreach ($product->get_children() as $child_id) {
                    $variation = wc_get_product($child_id);
                    if (!$variation || !$variation->is_type('variation')) {
                        continue;
                    }

                    $status = $variation->get_status();
                    if (!in_array($status, ['publish', 'draft', 'private'], true)) {
                        continue;
                    }

                    fputcsv($output, self::map_product_row($variation, $product));
                }
                return;
            }

            if ($product->is_type('variation')) {
                return;
            }

            fputcsv($output, self::map_product_row($product));
        }

        private static function map_product_row(WC_Product $product, WC_Product $parent = null)
        {
            $type = $product->get_type();
            $prices = self::get_export_prices($product);
            $stock_qty = self::get_export_stock_quantity($product);
            $in_stock = $product->is_in_stock() ? 1 : 0;
            $attributes = self::extract_attributes($product, $parent);
            $source_product = ($product->is_type('variation') && $parent) ? $parent : $product;
            $source_id = $source_product->get_id();

            $row = [
                $product->get_id(),
                $type,
                $product->get_sku(),
                self::clean_text($product->get_name()),
                $product->get_slug(),
                $product->get_status() === 'publish' ? 1 : 0,
                $product->is_featured() ? 1 : 0,
                $product->get_catalog_visibility(),
                self::clean_text($product->get_short_description() ?: ($parent ? $parent->get_short_description() : '')),
                self::clean_text($product->get_description() ?: ($parent ? $parent->get_description() : '')),
                $prices['sale'],
                $prices['regular'],
                self::get_category_path($source_id),
                self::get_term_names($source_id, 'product_tag'),
                self::get_brand_name($source_id),
                $in_stock,
                $stock_qty,
                $stock_qty,
                self::get_image_urls($product, $parent),
                self::get_parent_reference($product, $parent),
                $product->get_weight(),
                $product->get_length(),
                $product->get_width(),
                $product->get_height(),
            ];

            for ($index = 0; $index < self::MAX_ATTRIBUTES; $index++) {
                $row[] = $attributes[$index]['name'];
                $row[] = $attributes[$index]['values'];
                $row[] = $attributes[$index]['visible'];
                $row[] = $attributes[$index]['global'];
            }

            return $row;
        }

        private static function get_export_prices(WC_Product $product)
        {
            $regular = $product->get_regular_price();
            $sale = $product->get_sale_price();
            $active = $product->get_price();

            if ($sale === '' && $regular === '' && $active !== '') {
                $regular = $active;
            }

            if ($sale !== '' && $regular === '') {
                $regular = $sale;
            }

            return [
                'sale' => $sale !== '' ? $sale : '',
                'regular' => $regular !== '' ? $regular : ($sale !== '' ? $sale : ''),
            ];
        }

        private static function get_export_stock_quantity(WC_Product $product)
        {
            if ($product->get_manage_stock()) {
                $stock_qty = $product->get_stock_quantity();
                return $stock_qty !== null && $stock_qty !== '' ? max(0, (int) $stock_qty) : 0;
            }

            if ($product->is_in_stock()) {
                return 999;
            }

            return 0;
        }

        private static function clean_text($value)
        {
            $text = html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $text = wp_kses_post($text);
            $text = preg_replace('/\s+/u', ' ', $text);
            return trim($text);
        }

        private static function get_image_urls(WC_Product $product, WC_Product $parent = null)
        {
            if ($product->is_type('variation')) {
                return self::get_variation_image_urls($product);
            }

            $ids = [];

            $featured_id = $product->get_image_id();
            if ($featured_id) {
                $ids[] = (int) $featured_id;
            }

            foreach ($product->get_gallery_image_ids() as $gallery_id) {
                $gallery_id = (int) $gallery_id;
                if ($gallery_id && !in_array($gallery_id, $ids, true)) {
                    $ids[] = $gallery_id;
                }
            }

            return self::attachment_ids_to_urls($ids);
        }

        private static function get_variation_image_urls(WC_Product $variation)
        {
            $featured_id = (int) $variation->get_image_id();
            if (!$featured_id) {
                return '';
            }

            return self::attachment_ids_to_urls([$featured_id]);
        }

        private static function attachment_ids_to_urls(array $ids)
        {
            $urls = [];
            foreach ($ids as $attachment_id) {
                $url = wp_get_attachment_url((int) $attachment_id);
                if ($url) {
                    $urls[] = $url;
                }
            }

            return implode(', ', $urls);
        }

        private static function get_category_path($product_id)
        {
            $terms = get_the_terms($product_id, 'product_cat');
            if (empty($terms) || is_wp_error($terms)) {
                return '';
            }

            $paths = [];
            foreach ($terms as $term) {
                $parts = [];
                $current = $term;
                while ($current && !is_wp_error($current)) {
                    array_unshift($parts, $current->name);
                    if (!$current->parent) {
                        break;
                    }
                    $current = get_term($current->parent, 'product_cat');
                }
                if ($parts) {
                    $paths[] = implode(' > ', $parts);
                }
            }

            return implode(', ', array_unique($paths));
        }

        private static function get_term_names($product_id, $taxonomy)
        {
            $terms = get_the_terms($product_id, $taxonomy);
            if (empty($terms) || is_wp_error($terms)) {
                return '';
            }

            return implode(', ', wp_list_pluck($terms, 'name'));
        }

        private static function get_brand_name($product_id)
        {
            $brand_taxonomies = [
                'product_brand',
                'pwb-brand',
                'yith_product_brand',
                'brand',
                'pa_brand',
            ];

            foreach ($brand_taxonomies as $taxonomy) {
                if (!taxonomy_exists($taxonomy)) {
                    continue;
                }
                $names = self::get_term_names($product_id, $taxonomy);
                if ($names) {
                    return $names;
                }
            }

            return '';
        }

        private static function get_parent_reference(WC_Product $product, WC_Product $parent = null)
        {
            if (!$product->is_type('variation')) {
                return '';
            }

            $parent_product = $parent ?: wc_get_product($product->get_parent_id());
            if (!$parent_product) {
                return 'id:' . $product->get_parent_id();
            }

            if ($parent_product->get_sku()) {
                return $parent_product->get_sku();
            }

            return 'id:' . $parent_product->get_id();
        }

        private static function extract_attributes(WC_Product $product, WC_Product $parent = null)
        {
            $blank = [
                'name' => '',
                'values' => '',
                'visible' => '',
                'global' => '',
            ];

            $rows = array_fill(0, self::MAX_ATTRIBUTES, $blank);
            $source_attributes = [];

            if ($product->is_type('variation')) {
                $variation_attributes = $product->get_variation_attributes();
                foreach ($variation_attributes as $attribute_name => $attribute_value) {
                    if ($attribute_value === '' || $attribute_value === null) {
                        continue;
                    }

                    $taxonomy = str_replace('attribute_', '', $attribute_name);
                    $label = wc_attribute_label($taxonomy);
                    $display_value = self::resolve_attribute_value($taxonomy, $attribute_value);

                    $source_attributes[] = [
                        'name' => $label,
                        'values' => $display_value,
                        'visible' => 1,
                        'global' => taxonomy_exists($taxonomy) ? 1 : 0,
                    ];
                }
            } else {
                foreach ($product->get_attributes() as $attribute) {
                    if (!$attribute) {
                        continue;
                    }

                    $source_attributes[] = [
                        'name' => wc_attribute_label($attribute->get_name()),
                        'values' => self::format_attribute_values($attribute),
                        'visible' => $attribute->get_visible() ? 1 : 0,
                        'global' => $attribute->is_taxonomy() ? 1 : 0,
                    ];
                }
            }

            if (empty($source_attributes) && $parent) {
                return self::extract_attributes($parent);
            }

            foreach ($source_attributes as $index => $attribute) {
                if ($index >= self::MAX_ATTRIBUTES) {
                    break;
                }

                $rows[$index] = [
                    'name' => self::clean_text($attribute['name']),
                    'values' => self::clean_text($attribute['values']),
                    'visible' => $attribute['visible'],
                    'global' => $attribute['global'],
                ];
            }

            return $rows;
        }

        private static function resolve_attribute_value($taxonomy, $attribute_value)
        {
            $display_value = (string) $attribute_value;

            if (taxonomy_exists($taxonomy)) {
                $term = get_term_by('slug', $attribute_value, $taxonomy);
                if ($term && !is_wp_error($term)) {
                    return $term->name;
                }

                if (is_numeric($attribute_value)) {
                    $term = get_term((int) $attribute_value, $taxonomy);
                    if ($term && !is_wp_error($term)) {
                        return $term->name;
                    }
                }
            }

            return $display_value;
        }

        private static function format_attribute_values($attribute)
        {
            $values = [];

            foreach ($attribute->get_options() as $option) {
                if ($attribute->is_taxonomy()) {
                    $taxonomy = $attribute->get_name();
                    $values[] = self::resolve_attribute_value($taxonomy, $option);
                    continue;
                }

                $values[] = (string) $option;
            }

            $values = array_values(array_filter(array_map('trim', $values), static function ($value) {
                return $value !== '';
            }));

            return implode(' | ', $values);
        }
    }

    add_action('plugins_loaded', function () {
        if (!class_exists('WooCommerce')) {
            return;
        }
        Store1920_Product_Export::boot();
    });
}

/*
 * ============================================================
 * PASTE INTO functions.php (alternative to plugin install)
 * Copy from line below until end of file if you prefer functions.php
 * ============================================================
 *
 * require_once get_stylesheet_directory() . '/store1920-product-export.php';
 *
 * Or upload this same file via FTP and require it from functions.php.
 */
