<?php
/**
 * Plugin Name: Store1920 Category Migrator
 * Description: Push WooCommerce product categories (including category images) to Store1920 migration API.
 * Version: 1.0.0
 * Author: Store1920
 */

if (!defined('ABSPATH')) {
    exit;
}

class Store1920CategoryMigrator {
    const OPTION_KEY = 'store1920_category_migrator_settings';
    const NOTICE_KEY = 'store1920_category_migrator_notice';
    const DEFAULT_BATCH_SIZE = 200;

    public function __construct() {
        add_action('admin_menu', array($this, 'register_admin_page'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_post_store1920_push_categories', array($this, 'handle_push_categories'));
        add_action('admin_notices', array($this, 'render_admin_notice'));
    }

    public function register_admin_page() {
        add_menu_page(
            'Store1920 Migrator',
            'Store1920 Migrator',
            'manage_options',
            'store1920-category-migrator',
            array($this, 'render_admin_page'),
            'dashicons-upload'
        );
    }

    public function register_settings() {
        register_setting('store1920_category_migrator_group', self::OPTION_KEY, array($this, 'sanitize_settings'));
    }

    public function sanitize_settings($input) {
        return array(
            'api_url' => isset($input['api_url']) ? esc_url_raw(trim($input['api_url'])) : '',
            'migration_token' => isset($input['migration_token']) ? sanitize_text_field($input['migration_token']) : '',
            'store_username' => isset($input['store_username']) ? sanitize_text_field($input['store_username']) : '',
            'batch_size' => isset($input['batch_size']) ? max(20, min(500, intval($input['batch_size']))) : 200,
        );
    }

    private function get_settings() {
        return get_option(self::OPTION_KEY, array(
            'api_url' => '',
            'migration_token' => '',
            'store_username' => '',
            'batch_size' => self::DEFAULT_BATCH_SIZE,
        ));
    }

    private function get_setting($settings, $key, $default = '') {
        return isset($settings[$key]) ? trim((string) $settings[$key]) : $default;
    }

    public function render_admin_notice() {
        $notice = get_transient(self::NOTICE_KEY);
        if (!$notice) {
            return;
        }

        delete_transient(self::NOTICE_KEY);
        $class = !empty($notice['success']) ? 'notice notice-success' : 'notice notice-error';
        echo '<div class="' . esc_attr($class) . '"><p>' . esc_html($notice['message']) . '</p></div>';
    }

    private function set_notice($message, $success = true) {
        set_transient(self::NOTICE_KEY, array(
            'message' => $message,
            'success' => $success,
        ), 120);
    }

    public function render_admin_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $settings = $this->get_settings();

        ?>
        <div class="wrap">
            <h1>Store1920 Category Migrator</h1>
            <p>First migration step: send all WooCommerce product categories and category images to Store1920.</p>

            <form method="post" action="options.php" style="max-width: 760px;">
                <?php settings_fields('store1920_category_migrator_group'); ?>

                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="store1920_api_url">Store1920 API URL</label></th>
                        <td>
                            <input type="url" id="store1920_api_url" name="<?php echo esc_attr(self::OPTION_KEY); ?>[api_url]" class="regular-text" value="<?php echo esc_attr($settings['api_url']); ?>" placeholder="https://your-new-site.com/api/store/migration/wp-categories" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="store1920_migration_token">Migration token</label></th>
                        <td>
                            <input type="text" id="store1920_migration_token" name="<?php echo esc_attr(self::OPTION_KEY); ?>[migration_token]" class="regular-text" value="<?php echo esc_attr($settings['migration_token']); ?>" placeholder="Same token as WP_MIGRATION_TOKEN in Store1920" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="store1920_store_username">Store username</label></th>
                        <td>
                            <input type="text" id="store1920_store_username" name="<?php echo esc_attr(self::OPTION_KEY); ?>[store_username]" class="regular-text" value="<?php echo esc_attr($settings['store_username']); ?>" placeholder="Exact store username in new app" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="store1920_batch_size">Batch size</label></th>
                        <td>
                            <input type="number" id="store1920_batch_size" name="<?php echo esc_attr(self::OPTION_KEY); ?>[batch_size]" min="20" max="500" value="<?php echo esc_attr(intval($settings['batch_size'])); ?>" />
                            <p class="description">Recommended: 200</p>
                        </td>
                    </tr>
                </table>

                <?php submit_button('Save Settings'); ?>
            </form>

            <hr />

            <h2>Push Categories</h2>
            <p>This will send all WooCommerce <code>product_cat</code> terms with image URLs and parent hierarchy.</p>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('store1920_push_categories'); ?>
                <input type="hidden" name="action" value="store1920_push_categories" />
                <?php submit_button('Push Categories Now', 'primary', 'submit', false); ?>
            </form>
        </div>
        <?php
    }

    private function collect_categories() {
        $terms = get_terms(array(
            'taxonomy' => 'product_cat',
            'hide_empty' => false,
        ));

        if (is_wp_error($terms)) {
            return array();
        }

        $payload = array();

        foreach ($terms as $term) {
            $thumbnail_id = get_term_meta($term->term_id, 'thumbnail_id', true);
            $image_url = $thumbnail_id ? wp_get_attachment_url($thumbnail_id) : '';
            $term_link = get_term_link($term);

            $payload[] = array(
                'externalId' => strval($term->term_id),
                'parentExternalId' => $term->parent ? strval($term->parent) : '',
                'name' => $term->name,
                'slug' => $term->slug,
                'description' => wp_strip_all_tags($term->description),
                'image' => $image_url ? esc_url_raw($image_url) : '',
                'url' => !is_wp_error($term_link) ? esc_url_raw($term_link) : '',
            );
        }

        return $payload;
    }

    private function build_request_payload($token, $store_username, $categories) {
        return wp_json_encode(array(
            'migrationToken' => $token,
            'storeUsername' => $store_username,
            'categories' => $categories,
        ));
    }

    private function post_categories_chunk($api_url, $token, $store_username, $chunk) {
        return wp_remote_post($api_url, array(
            'timeout' => 120,
            'headers' => array(
                'Content-Type' => 'application/json',
                'x-migration-token' => $token,
                'Authorization' => 'Bearer ' . $token,
            ),
            'body' => $this->build_request_payload($token, $store_username, $chunk),
        ));
    }

    private function extract_api_error($response) {
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded = json_decode($body, true);

        if (is_array($decoded) && !empty($decoded['error'])) {
            return sprintf('%s (HTTP %d)', $decoded['error'], $status_code);
        }

        $trimmed = trim((string) $body);
        if ($trimmed !== '') {
            return sprintf('%s (HTTP %d)', $trimmed, $status_code);
        }

        return sprintf('Unknown API error (HTTP %d)', $status_code);
    }

    public function handle_push_categories() {
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        check_admin_referer('store1920_push_categories');

        $settings = $this->get_settings();
        $api_url = $this->get_setting($settings, 'api_url');
        $token = $this->get_setting($settings, 'migration_token');
        $store_username = $this->get_setting($settings, 'store_username');
        $batch_size = isset($settings['batch_size']) ? max(20, min(500, intval($settings['batch_size']))) : self::DEFAULT_BATCH_SIZE;

        if (!$api_url || !$token || !$store_username) {
            $this->set_notice('Missing API URL, migration token, or store username.', false);
            wp_safe_redirect(admin_url('admin.php?page=store1920-category-migrator'));
            exit;
        }

        $categories = $this->collect_categories();
        if (empty($categories)) {
            $this->set_notice('No WooCommerce categories found to export.', false);
            wp_safe_redirect(admin_url('admin.php?page=store1920-category-migrator'));
            exit;
        }

        $chunks = array_chunk($categories, $batch_size);
        $total_sent = 0;

        foreach ($chunks as $chunk) {
            $response = $this->post_categories_chunk($api_url, $token, $store_username, $chunk);

            if (is_wp_error($response)) {
                $this->set_notice('Push failed: ' . $response->get_error_message(), false);
                wp_safe_redirect(admin_url('admin.php?page=store1920-category-migrator'));
                exit;
            }

            $status_code = wp_remote_retrieve_response_code($response);

            if ($status_code < 200 || $status_code >= 300) {
                $error_message = $this->extract_api_error($response);
                $this->set_notice('Push failed: ' . $error_message, false);
                wp_safe_redirect(admin_url('admin.php?page=store1920-category-migrator'));
                exit;
            }

            $total_sent += count($chunk);
        }

        $this->set_notice('Categories pushed successfully. Total sent: ' . $total_sent, true);
        wp_safe_redirect(admin_url('admin.php?page=store1920-category-migrator'));
        exit;
    }
}

new Store1920CategoryMigrator();
